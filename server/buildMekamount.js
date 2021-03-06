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
const metaplex = require('@metaplex-foundation/mpl-token-metadata');
const meta = require('@metaplex/js');
const web3 = require('@solana/web3.js');

function getNFTOwner(nftAddress){
  return new Promise((resolve, reject) => {

    //TODO look into this
    //Probably grabs first owner
    //will disable check
    resolve()
    return;

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

    const tokenAddress = new web3.PublicKey(
      nftAddress
    );

    const connection = new web3.Connection(
      web3.clusterApiUrl("mainnet-beta"),
      "confirmed"
    );

    meta.programs.metadata.Metadata.findByMint(
      connection,
      tokenAddress
    ).then((meta)=>{

      https.get(meta.data.data.uri, function(response) {
        let data = [];
      
        response.on('data', chunk => {
          data.push(chunk);
        });
      
        response.on('end', () => {
          try {
            const metadata = (JSON.parse(Buffer.concat(data).toString()));

            // console.log(JSON.parse(Buffer.concat(data).toString()));

            // reject("test");
            resolve({
              "url" : metadata.image,
              "authority" : meta.data.updateAuthority,
            });
          } catch ( error ) {
            reject(`Could not parse metadata: ${error}`);
          }
        });
      }).on('error', function(error) { // Handle errors
        reject(`Could not skim solscan: ${error}`);
      });
    }).catch((error)=>{
      reject(error);
    })
  });
}

function downloadFile(url, outputPath){
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

function improveBGAPI(inputPath, shouldReport){
  return new Promise((resolve, reject) => {

    if(shouldReport){
      const formData = new FormData();
      formData.append('image_file', fs.createReadStream(inputPath), path.basename(inputPath));
      formData.append('tag', 'nft-pfps');
  
      axios({
        method: 'post',
        url: 'https://api.remove.bg/v1.0/improve',
        data: formData,
        responseType: 'arraybuffer',
        headers: {
          ...formData.getHeaders(),
          'X-Api-Key': 'S73qUka2SUJ1p9KWDEQB4sFk',
      
        },
        encoding: null
      })
      .then((response) => {
        if(response.status != 200){
          reject(`Need a 200 response! (${response})`);
        } else {
          resolve(true);
        }
      })
      .catch((error) => {
        reject(`Not enough remove.bg credits. Probably.`);
      });
    } else {
      resolve(false);
    }
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
        'X-Api-Key': 'DS19ymHYciK5NHtdNP8ei9Qc',
    
      },
      encoding: null
    })
    .then((response) => {
      if(response.status != 200) reject(`Need a 200 response!`);
      fs.writeFileSync(outputPath, response.data);
      resolve();
    })
    .catch((error) => {
      console.log(error);
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
        reject(`Could not read img for jimp flip: ${error}`);
      });
    } else {
      resolve();
    }
  });
}

function cropIMG(path, cropSize, quadrant, shouldCrop){
  return new Promise((resolve, reject) => {

    if(shouldCrop === 'true'){
      jimp.read(path).then((img)=>{
        img.crop(
          (quadrant === 3 || quadrant === 2) ? 0 : cropSize,
          (quadrant === 3 || quadrant === 0) ? 0 : cropSize, 
          cropSize, 
          cropSize
        )
        .write(path, (file)=>{
          resolve();
        });
      })
      .catch(function(error) {
        reject(`Could not read img for jimp crop: ${error}`);
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

function buildMekamount(sol, mekaNFT, mekaFliped, pfpNFT, pfpFlipped, twitterCrop, pfpScale, buildCount, shouldReport, success, failure){

  Promise.all([
    getNFTOwner(mekaNFT),
    getNFTOwner(pfpNFT),
  ])
  .then((owners)=>{

    // Grabs the first owner
    // if(owners.length != 2) { failure("Bad owner count"); return;}
    // console.log(sol);
    // console.log(owners[0]);
    // console.log(owners[1]);

    // if(owners[0] != sol){ failure("Not owner"); return;}
    // if(owners[1] != sol){ failure("Not owner"); return;}

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
        downloadFile(pfpURL, pfpFilePath),
        downloadFile(mekURL, mekFilePath),
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
                cropIMG(
                  finalFilePath,
                  mekSize / 2,
                  (mekaFliped === 'true') ? 0 : 3,
                  twitterCrop
                ).then(()=>{
                  improveBGAPI(
                    pfpFilePath,
                    shouldReport,
                  ).then((didReport)=>{
                    if(didReport){
                      console.log(`-- REPORTED for: ${pfpNFT}`);
                    }
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

function nuke(solAddress){
  fs.readdirSync("./img/")
  .filter(file => file.includes(solAddress))
  .map(file => fs.unlinkSync("./img/" + file));
}

function improveAI(pfpPath, pfpNFT){
  return new Promise((resolve, reject) => {
    fs.copyFile( 
      pfpFilePath, 
      `./feedback/bad_pfp_${pfpNFT}.png`, 
      fs.constants.COPYFILE_EXCL, 
      ((error)=>{
        if(error){
          reject(`Error copying pfp to feedback bucket ${error}`);
        } else {
          resolve();
        }
      }),
    );
  });
}

// Coach Wallet JD5C5Bsp3q9jeC5S57QuSCDDfpeKzXvRkfPB3Td6x3Wh
// Coach Mek 5B1QZJYws1Nnp8Kh3FWVoeQbasr5tJeyiZZnWz8sxDZf
// Captain Noot 53jUws4b8ytG17nCd7MPsYxhYwxF515R4AgvBTE3qkUk

// ROB wallet HGTwNH2uava9rCeskgJ96yzMNpfi89XCCav6bVyGicqH
// ROB mek 98NNmfBV3oz7d7Ky2H9v6Tu8dmBSgUTFPHzA7DsXn3th
// ROB pfp GqoFuGZrQK1DqpHTUre7DAzyLD6AKYMCLA9CMvBHxQJa
function testBuilder(nukeAfter){
  let solAddress = 'HGTwNH2uava9rCeskgJ96yzMNpfi89XCCav6bVyGicqH';
  let mekAddress = '98NNmfBV3oz7d7Ky2H9v6Tu8dmBSgUTFPHzA7DsXn3th';
  let isMekFlipped = 'false';
  let pfpAddress = 'GqoFuGZrQK1DqpHTUre7DAzyLD6AKYMCLA9CMvBHxQJa';
  let isPfpFlipped = 'false';
  let isTwitterCropped = 'false';
  let shouldReport = false;
  let pfpScale = defaultpfpScale;
  let buildCount = 2;

  buildMekamount(
    solAddress, 
    mekAddress, 
    isMekFlipped,
    pfpAddress,
    isPfpFlipped, 
    isTwitterCropped,
    pfpScale,
    buildCount,
    shouldReport,
    ()=>{
      if(nukeAfter){nuke(solAddress);}
      console.log("SUCCESS");
    }, 
    (error)=>{console.log("ERROR " + error);}
  );
}

testBuilder(true);

module.exports = { buildMekamount, nuke, defaultpfpScale, fileTail};
