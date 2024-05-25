const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const icloudSharedAlbum = require('icloud-shared-album');
const https = require('https');

const MAX_CONCURRENT_DOWNLOADS = 10;

function extractFilename(url) {
  const match = url.split('?')[0].match(/[^/]+$/);
  return match ? match[0] : null;
}

// Function to download a file
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);

    const request = https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(`Downloaded: ${filePath}`);
        });
      } else {
        reject(`Server responded with ${response.statusCode}`);
      }
    });

    request.on('error', (err) => {
      fs.unlink(filePath);
      reject(`Error downloading ${url}: ${err}`);
    });
  });
}

async function downloadAlbum() {
  if (!fs.existsSync("album")) {
    fs.mkdirSync("album", { recursive: true });
  }

  const jsonData = JSON.parse(fs.readFileSync("./album.json", 'utf-8'));
  const photos = jsonData.photos;
  const downloadPromises = [];

  const downloadAndWait = async (photo, index) => {
    console.log(`Downloading file ${index}`);
    const asset = photo;
    const key = Object.keys(asset.derivatives).sort((a, b) => parseInt(b) - parseInt(a))[0];
    const url = asset.derivatives[key].url;

    const fileName = extractFilename(url);
    const filePath = path.join(__dirname, 'album', fileName);

    if (!fs.existsSync(filePath)) {
      await downloadFile(url, filePath);
    }
  };

  for (let i = 0; i < photos.length; i += MAX_CONCURRENT_DOWNLOADS) {
    const chunk = photos.slice(i, i + MAX_CONCURRENT_DOWNLOADS);
    const chunkPromises = chunk.map((photo, index) => downloadAndWait(photo, i + index));
    downloadPromises.push(...chunkPromises);

    await Promise.all(chunkPromises);
  }

  await Promise.all(downloadPromises);
}

function downloadAlbumJSON(albumID){
  if(fs.existsSync("album.json")){
    console.log("Album json already downloaded");
    return;
  }

  console.log("Downloading Album JSON, this could take a while");
  var albumJSON = await icloudSharedAlbum.getImages(albumID);
  fs.writeFileSync('album.json', JSON.stringify(albumJSON));
}



// Example usage
//https://www.icloud.com/sharedalbum/#xxxxxxxx
const albumId = "xxxxxxxxxxx"; 
await downloadAlbumJSON();
await downloadAlbum();



