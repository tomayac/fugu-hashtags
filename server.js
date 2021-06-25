const fastify = require('fastify')({
  logger: true
});
const fetch = require('node-fetch');
const { DOMParser, XMLSerializer } = require("xmldom");

const getHashtags = async () => {
  return new Promise((resolve, reject) => {
    fetch(
      "https://web.dev/tags/capabilities/feed.xml"
    )
    .then(response => response.text())
    .then(body => {
      const re = /https:\/\/twitter\.com\/search\?q=.*?&amp;+/g;
      const hashtags = [];
      let match;
      while ((match = re.exec(body)) !== null) {
        hashtags.push(
          match[0]
            .replace("https://twitter.com/search?q=%23", "")
            .replace("&amp;", "")
        );
      }
      resolve(hashtags);
    })
    .catch(err => reject(err));
  });
};

fastify.get("/", async (req, res) => {
  try {
    const hashtags = await getHashtags();
    res.send(
      `<hashtags>\n${hashtags
        .map(hashtag => {
          return `  <hashtag>${hashtag}</hashtag>\n`;
        })
        .join("")}</hashtags>\n`
    );
  } catch (err) {
    console.error(err.name, err.message);
    res.status = 500;
    res.send("Internal server error");
  }
});

fastify.get("/rss", async (req, res) => {
  try {
    const hashtags = await getHashtags();
    const promises = hashtags.map(hashtag => {
      const url = `https://tomayac.com/rss/searchrss.php?q=%23${hashtag}&rt=recent&c=200`;
      return new Promise((resolve, reject) => {
        fetch(url)
        .then(response => response.text())
        .then(body => resolve(body))
        .catch(err => reject(err));
      });
    });
    const [first, ...rest] = await Promise.all(promises);
    const rootDoc = new DOMParser().parseFromString(first, "text/xml");
    const channel = rootDoc.documentElement.getElementsByTagName("channel")[0];

    const title = rootDoc.documentElement.getElementsByTagName("title")[0];
    while (title.firstChild) {
      title.removeChild(title.firstChild);
    }
    title.appendChild(
      rootDoc.createTextNode('Project Fugu 🐡 Hashtags')
    );

    const description = rootDoc.documentElement.getElementsByTagName(
      "description"
    )[0];
    while (description.firstChild) {
      description.removeChild(description.firstChild);
    }
    description.appendChild(
      rootDoc.createTextNode(`Twitter search for "#${hashtags.join('", "#')}"`)
    );

    const image = rootDoc.documentElement.getElementsByTagName("image")[0];
    rootDoc.removeChild(image);

    const link = rootDoc.documentElement.getElementsByTagName("link")[0];
    while (link.firstChild) {
      link.removeChild(link.firstChild);
    }
    link.appendChild(
      rootDoc.createTextNode("https://fugu-hashtags.glitch.me/rss")
    );

    const atomLink = rootDoc.documentElement.getElementsByTagNameNS(
      "http://www.w3.org/2005/Atom",
      "link"
    )[0];
    while (atomLink.firstChild) {
      atomLink.removeChild(atomLink.firstChild);
    }
    atomLink.appendChild(
      rootDoc.createTextNode("https://fugu-hashtags.glitch.me/rss")
    );
    atomLink.setAttribute("href", "https://fugu-hashtags.glitch.me/rss");

    rest.forEach(result => {
      const doc = new DOMParser().parseFromString(result, "text/xml");
      const items = doc.documentElement.getElementsByTagName("item");
      Array.from(items).forEach(item => {
        channel.appendChild(item);
      });
    });
    res.send(new XMLSerializer().serializeToString(rootDoc));
  } catch (err) {
    res.status = 500;
    res.send(`Internal server error\n\n${err.name}:\n${err.message}`);
  }
});

fastify.get("/follow", async (req, res) => {
  res.send(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">

  <title>Project Fugu 🐡 Hashtags</title>
  <link rel="alternate" type="application/rss+xml" title="Project Fugu 🐡 Hashtags" href="/rss" />
</head>

<body>
  This page has an <a href="/rss">RSS feed</a>.
</body>
</html>
  `)
});

fastify.listen(process.env.PORT, (err, address) => {
  if (err) throw err
  console.log(`Server is now listening on ${address}`);
});
