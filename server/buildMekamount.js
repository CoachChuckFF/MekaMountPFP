const https = require('follow-redirects').https;
const querystring = require('query-string');
var jimp = require('jimp');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const mergeImages = require('merge-images');
const sharp = require('sharp');
const { Canvas, Image } = require('canvas');


function getNFTOwner(nftAddress){
  return new Promise((resolve, reject) => {
    const parameters = {
      offset: 0,
      limit: 1,
      tokenAddress: nftAddress
    }

    const url = {
      hostname: 'public-api.solscan.io',
      path: "/token/holders?" + querystring.stringify(parameters),
      headers: {
        'accept': 'application/json'
      }
    }

    https.get(url, function(response) {
      let data = [];
    
      response.on('data', chunk => {
        data.push(chunk);
      });
    
      response.on('end', () => {
        const solScanResponse = JSON.parse(Buffer.concat(data).toString());
        if(solScanResponse.data == null){
          reject(`Naughty nft`);
        } else {
          resolve(solScanResponse.data[0].owner);
        }
      });
    }).on('error', function(error) { // Handle errors
      reject(`Could not skim solscan: ${error}`);
    });
  });
}

function getLinkFromSolana(nftAddress){
  return new Promise((resolve, reject) => {
    const url = {
      hostname: 'public-api.solscan.io',
      path: `/account/${nftAddress}`,
      headers: {
        'accept': 'application/json'
      }
    }

    https.get(url, function(response) {
      let data = [];
    
      response.on('data', chunk => {
        data.push(chunk);
      });
    
      response.on('end', () => {
        const metadata = (JSON.parse(Buffer.concat(data).toString())).metadata;

        resolve({
          "url" : metadata.data.image,
          "authority" : metadata.updateAuthority,
        });

      });
    }).on('error', function(error) { // Handle errors
      reject(`Could not skim solscan: ${error}`);
    });
  });
}

function downloadIMG(url, outputPath){
  return new Promise((resolve, reject) => {
    var file = fs.createWriteStream(outputPath);
    https.get(url, function(response) {
      response.pipe(file);
      file.on('finish', function() {
        file.close(()=>{resolve();});  // close() is async, call cb after close completes.
      });
    }).on('error', function(err) { // Handle errors
      fs.unlink(outputPath);
      reject(`Could not download ${url}`);
    });
  });
}

function removeBGAPI(inputPath, outputPath){
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('image_file', fs.createReadStream(inputPath), path.basename(inputPath));
    formData.append('size', 'preview');
    formData.append('type', 'auto');
    formData.append('type_level', 'latest');
    formData.append('format', 'png');

    axios({
      method: 'post',
      url: 'https://api.remove.bg/v1.0/removebg',
      data: formData,
      responseType: 'arraybuffer',
      headers: {
        ...formData.getHeaders(),
        'X-Api-Key': 'S73qUka2SUJ1p9KWDEQB4sFk',
    
      },
      encoding: null
    })
    .then((response) => {
      if(response.status != 200) reject(`Need a 200 response!`);
      fs.writeFileSync(outputPath, response.data);
      resolve();
    })
    .catch((error) => {
      reject(`Not enough remove.bg credits. Probably.`);
    });
  });
}

function resizeIMG(inputPath, outputPath, size){
  return new Promise((resolve, reject) => {
    sharp(inputPath).resize({ height: size }).toFile(outputPath)
    .then(function(newFileInfo) {
      resolve();
    })
    .catch(function(error) {
      reject(`Could not resize pfp: ${error}`);
    });
  });
}

function flipIMG(path, shouldFlip){
  return new Promise((resolve, reject) => {
    if(shouldFlip === 'true'){
      jimp.read(path).then((img)=>{
        img.flip(true, false)
        .write(path, (file)=>{
          resolve();
        });
      })
      .catch(function(error) {
        reject(`Could not read img for jimp: ${error}`);
      });
    } else {
      resolve();
    }
  });
}

function mergeIMG(backgroundPath, foregroundPath, outputFile, forgroundX, forgroundY){
  return new Promise((resolve, reject) => {
    mergeImages(
      [{ src: backgroundPath, x: 0, y: 0 },
      { src: foregroundPath, x: forgroundX, y: forgroundY},],
      {Canvas: Canvas, Image: Image}
    ).then(b64 => {
      fs.writeFileSync(outputFile, b64.split(';base64,').pop(), {encoding: 'base64'});
      resolve();
    })    
    .catch(function(error) {
      reject(`Could not merge meka: ${error}`);
    });
  });
}

const arweaveURL = "arweave.net/";
const mekaUpdateAuthority = "mekR3HMzbE2s7SHWMEJLJ2GKwk3DoZfRo9urCsgtHLy";
const fileTail = ".png";

const mekSize = 2222;
const defaultpfpScale = 0.18;
const pfpCenterX = 355;
const pfpBottomY = 560;
function getPFPSize(scale){return Math.round((mekSize * scale)) + (2 * (Math.round(mekSize * scale) % 2));}

function buildMekamount(sol, mekaNFT, mekaFliped, pfpNFT, pfpFlipped, pfpScale, buildCount, success, failure){

  Promise.all([
    getNFTOwner(mekaNFT),
    getNFTOwner(pfpNFT),
  ])
  .then((owners)=>{

    if(owners.length != 2) { failure("Bad owner count"); return;}

    if(owners[0] != sol){ failure("Not owner"); return;}
    if(owners[1] != sol){ failure("Not owner"); return;}

    Promise.all([
      getLinkFromSolana(mekaNFT),
      getLinkFromSolana(pfpNFT),
    ]).then((urls)=> {

      let pfpURL = "";
      let mekURL = "";

      if(urls.length != 2) { failure("Bad URL count"); return;}

      if(urls[0].authority == mekaUpdateAuthority){
        mekURL = urls[0].url;
        pfpURL = urls[1].url;
      } else if(urls[1].authority == mekaUpdateAuthority){
        mekURL = urls[1].url;
        pfpURL = urls[0].url;
      } else { failure("No meka"); return;}
  
      if(!pfpURL.includes(arweaveURL)){ failure("Bad pfp url"); return;}
      if(!pfpURL.includes(arweaveURL)){ failure("Bad pfp url"); return;}
    
      let pfpFilePath = `./img/${sol}_${buildCount}_pfp.png`;
      let mekFilePath = `./img/${sol}_${buildCount}_mek.png`;
      let pfpAlphaFilePath = `./img/${sol}_${buildCount}_pfp_alpha.png`;
      let pfpMiniAlphaFilePath = `./img/${sol}_${buildCount}_pfp_mini_alpha.png`;
      let finalFilePath = `./img/${sol}_${buildCount}_${fileTail}`;
    
      Promise.all([
        downloadIMG(pfpURL, pfpFilePath),
        downloadIMG(mekURL, mekFilePath),
      ])
      .then(() => {
        removeBGAPI(pfpFilePath, pfpAlphaFilePath)
        .then(()=>{
          resizeIMG(pfpAlphaFilePath, pfpMiniAlphaFilePath, getPFPSize(pfpScale))
          .then(()=>{
            Promise.all([
              flipIMG(mekFilePath, mekaFliped),
              flipIMG(pfpMiniAlphaFilePath, pfpFlipped),
            ]).then(()=>{
              mergeIMG(
                mekFilePath, 
                pfpMiniAlphaFilePath, 
                finalFilePath, 
                (mekaFliped === 'true') ? (mekSize - (pfpCenterX + (getPFPSize(pfpScale) / 2))) : (pfpCenterX - (getPFPSize(pfpScale) / 2)), 
                pfpBottomY - getPFPSize(pfpScale)
              )
              .then(()=>{
                success(finalFilePath);
              })
              .catch((data) => failure(data));
            })
            .catch((data) => failure(data));
          })
          .catch((data) => failure(data));
        })
        .catch((data) => failure(data));
      })
      .catch((data) => failure(data))
    })
    .catch((data) => failure(data));
  })
  .catch((data) => failure(data));
}


module.exports = { buildMekamount, defaultpfpScale, fileTail};
