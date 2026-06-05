const DROPBOX_URL = 'https://www.dropbox.com/scl/fi/a8obsjt5w7v851tiozolc/Items.xlsx?rlkey=1zoynfpwamdxzbafa5c3v1ofv&st=qmvr4q05&dl=1';

export default async function handler(_req, res) {
  try {
    const upstream = await fetch(DROPBOX_URL, {
      redirect: 'follow',
      headers: {
        'user-agent': 'launch-radar-vercel-proxy',
      },
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: `Dropbox responded with ${upstream.status} ${upstream.statusText}`,
      });
      return;
    }

    const contentType =
      upstream.headers.get('content-type') ||
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).send(buffer);
  } catch (error) {
    res.status(502).json({
      error: error?.message || 'Unable to fetch the Dropbox file',
    });
  }
}
