const https = require('https');
const fs = require('fs');
const path = require('path');

const fonts = {
  "Inter": "https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-Regular.ttf",
  "Bebas Neue": "https://github.com/google/fonts/raw/main/ofl/bebasneue/BebasNeue-Regular.ttf",
  "Cinzel": "https://github.com/google/fonts/raw/main/ofl/cinzel/static/Cinzel-Regular.ttf",
  "Lora": "https://github.com/google/fonts/raw/main/ofl/lora/static/Lora-Regular.ttf",
  "Montserrat": "https://github.com/google/fonts/raw/main/ofl/montserrat/static/Montserrat-Regular.ttf",
  "Oswald": "https://github.com/google/fonts/raw/main/ofl/oswald/static/Oswald-Regular.ttf",
  "Outfit": "https://github.com/google/fonts/raw/main/ofl/outfit/static/Outfit-Regular.ttf",
  "Playfair Display": "https://github.com/google/fonts/raw/main/ofl/playfairdisplay/static/PlayfairDisplay-Regular.ttf",
  "Poppins": "https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Regular.ttf",
  "PT Serif": "https://github.com/google/fonts/raw/main/ofl/ptserif/PTSerif-Regular.ttf",
  "Raleway": "https://github.com/google/fonts/raw/main/ofl/raleway/static/Raleway-Regular.ttf",
  "Roboto Slab": "https://github.com/google/fonts/raw/main/ofl/robotoslab/static/RobotoSlab-Regular.ttf",
  "Space Grotesk": "https://github.com/google/fonts/raw/main/ofl/spacegrotesk/static/SpaceGrotesk-Regular.ttf"
};

const outDir = path.join(__dirname, '../../data/fonts');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
      }
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function run() {
  for (const [name, url] of Object.entries(fonts)) {
    const dest = path.join(outDir, `${name}.ttf`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
      console.log(`${name} already exists.`);
      continue;
    }
    console.log(`Downloading ${name}...`);
    try {
      await download(url, dest);
      console.log(`Success: ${name}`);
    } catch (err) {
      console.error(`Error downloading ${name}:`, err.message);
    }
  }
  console.log('All done!');
}

run();
