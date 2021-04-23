import { GetStaticPaths, GetStaticProps } from 'next';
import { RichText } from 'prismic-dom';
import { FiCalendar, FiClock, FiUser } from 'react-icons/fi';
import Header from '../../components/Header';

import Prismic from '@prismicio/client'
import { getPrismicClient } from '../../services/prismic';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import commonStyles from '../../styles/common.module.scss';
import styles from './post.module.scss';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Comments from '../../components/Comments';

interface Post {
  first_publication_date: string | null;
  last_publication_date: string | null;
  data: {
    title: string;
    banner: {
      url: string;
    };
    author: string;
    content: {
      heading: string;
      body: {
        text: string;
      }[];
    }[];
  };
}

interface PostProps {
  post: Post;
  navigation: {
    previewPost: {
      uid: string;
      data: {
        title: string;
      }
    }[];
    nextPost: {
      uid: string;
      data: {
        title: string;
      }
    }[];
  }
  preview: boolean;
}

export default function Post({ post, navigation, preview }: PostProps) {
  const router = useRouter();

  if(router.isFallback) {
    return <h1>Carregando...</h1>
  }

  const totalWords = post.data.content.reduce((total, contentItem) => {
    total = total + contentItem.heading.split(' ').length;

    const words = contentItem.body.map(item => item.text.split(' ').length);
    words.map(word => (total = total +  word));
    return total;
  }, 0);
  const readTime = Math.ceil(totalWords / 200);

  const formateddate = format(
    new Date(post.first_publication_date),
    'dd MMM yyyy',
    {
      locale: ptBR
    }
  )

  const isEditPost = post.first_publication_date !== post.last_publication_date;

  let editionDate;

  if (isEditPost) {
    editionDate = format(
      new Date(post.last_publication_date),
      "'* editado em' dd MMM yyyy', às' H':'m",
      {
        locale: ptBR,
      }
    );
  }


  return (
    <>
      <Head>
        <title>{`${post.data.title} | spacetraveling`}</title>
      </Head>
      <Header />
      <img src={post.data.banner.url} alt="imagen" className={styles.banner} />
      <main className={commonStyles.container}>
        <div className={styles.post}>
          <div className={styles.postHeader}>
            <h1>{post.data.title}</h1>
            <ul>
              <li>
                <FiCalendar />
                {formateddate}
              </li>
              <li>
                <FiUser />
                {post.data.author}
              </li>
              <li>
                <FiClock />
                {`${readTime} min`}
              </li>
            </ul>

            {isEditPost && (
              <span>{editionDate}</span>
            )}
          </div>

          {post.data.content.map(content => (
            <article key={content.heading}>
              <h2>{content.heading}</h2>
              <div 
                className={styles.postHeader}
                dangerouslySetInnerHTML={{ __html: RichText.asHtml(content.body) }}
              />
            </article>
          ))}
        </div>

        <section className={`${styles.navigation} ${commonStyles.container}`}>
            {navigation?.previewPost.length > 0 && (
              <div>
                <h3>{navigation.previewPost[0].data.title}</h3>
                <Link href={`/post/${navigation.previewPost[0].uid}`}>
                  <a>Post anterior</a>
                </Link>
              </div>
            )}

            {navigation?.nextPost.length > 0 && (
              <div>
                <h3>{navigation.nextPost[0].data.title}</h3>
                <Link href={`/post/${navigation.nextPost[0].uid}`}>
                  <a>Próximo post</a>
                </Link>
              </div>
            )}
        </section>

        <Comments />

        {preview && (
          <aside>
            <Link href="/api/exit-preview">
              <a className={commonStyles.preview}>Sair do modo Preview</a>
            </Link>
          </aside>
        )}
      </main>
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const prismic = getPrismicClient();
  const posts = await prismic.query([
    Prismic.predicates.at('document.type', 'posts')
  ]);

  const paths = posts.results.map(post => {
    return {
      params: {
        slug: post.uid
      }
    }
  });

  return {
    paths,
    fallback: true
  }
};

export const getStaticProps: GetStaticProps = async ({
  params,
  preview = false,
  previewData
}) => {
  const prismic = getPrismicClient();
  const { slug } = params;

  const response = await prismic.getByUID('posts', String(slug), {
    ref: previewData?.ref || null
  });

  const previewPost = await prismic.query(
    [Prismic.Predicates.at('document.type', 'posts')],
    {
      pageSize: 1,
      after: response.id,
      orderings: '[document.first_publication_date]'
    }
  )

  const nextPost = await prismic.query(
    [Prismic.Predicates.at('document.type', 'posts')],
    {
      pageSize: 1,
      after: response.id,
      orderings: '[document.last_publication_date desc]'
    }
  )

  const post = {
    uid: response.uid,
    first_publication_date: response.first_publication_date,
    last_publication_date: response.last_publication_date,
    data: {
      title: response.data.title,
      subtitle: response.data.subtitle,
      author: response.data.author,
      banner: {
        url: response.data.banner.url
      },
      content: response.data.content.map(content => {
        return {
          heading: content.heading,
          body: [...content.body]
        }
      })
    }
  }

  return {
    props: {
      post,
      navigation: {
        previewPost: previewPost?.results,
        nextPost: nextPost?.results
      },
      preview
    }
  }
};
