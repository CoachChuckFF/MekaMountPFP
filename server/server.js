const express = require('express');
const fss = require('fs');
const meka = require('./createMekamount.js');
const web3 =  require("@solana/web3.js");
const app = express();
const port = process.env.PORT || 5000;

async function connectToSolana(){
    // //Solana Stuff
    // let connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'), 'confirmed');

    // let info = await connection.getSupply(new web3.PublicKey("5B1QZJYws1Nnp8Kh3FWVoeQbasr5tJeyiZZnWz8sxDZf"));
    // console.log(info);
}

function spinUpServer(){
    let creditsLeft = 10*4;

    //Connect To Solana
    let connection = connectToSolana();

    //Spin Up Server
    app.listen(port, () => console.log(`Listening on port ${port}`));

    //Set Hook
    app.get('/sol/:sol/meka/:meka/pfp/:pfp/scale/:scale', (req, res) => {
        try {
            console.log(`-- Buidling for: ${req.params.sol}...`);
            meka.buildMekamount(
                req.params.sol,
                req.params.meka,
                req.params.pfp,
                parseFloat(req.params.scale) ?? meka.defaultpfpScale,
                (filepath)=> {
                    creditsLeft--;
                    console.log(`-- SUCCESS for: ${req.params.sol}`);
                    res.download(filepath);
                },
                (error)=>{
                    console.log(`-- FAIL for: ${req.params.sol} (${error})`);
                    res.send({ error: error });
                }
            );
        } catch(error){
            console.log(`Trouble making Mek (${error})`);
        }
    });

    app.get('/credits', (req, res) => {
        try {
            res.send({ credits: creditsLeft });
        } catch {
            console.log(`Trouble gettings credits (${error})`);
        }
    });

    app.get('/clear/:clear', (req, res) => {
        try{
            fss.unlink(`./img/${req.params.clear}.png`, ()=>{});
            res.send({ theDeed: "is done" });
            console.log(`-- CLEARED for: ${req.params.clear}`);
        } catch (error) {
            console.log(`Trouble clearing mek (${error})`);
        }
    });

}

spinUpServer();