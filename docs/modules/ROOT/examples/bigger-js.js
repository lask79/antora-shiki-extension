// posts will be populated at build time by getStaticProps()
function Blog ({ posts }) { //<1>
  return (
    <ul>
      {posts.map((post) => (
        <li>{post.title}</li>
      ))}
    </ul>
  )
}

// This function gets called at build time on server-side.
export async function getStaticProps () {
  const res = await fetch('https://.../posts')
  const posts = await res.json()

  return { //<2>
    props: {
      posts,
    },
  }
}

export default Blog

// From https://nextjs.org/docs/basic-features/data-fetching
