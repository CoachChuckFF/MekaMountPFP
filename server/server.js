const express = require('express');
const fss = require('fs');
const meka = require('./createMekamount.js');
const web3 =  require("@solana/web3.js");
const app = express();
const port = process.env.PORT || 5000;

function getAttempt(mek, pfp, success, error){
    return {
        date : Date().toLocaleString(),
        mek : mek,
        pfp : pfp,
        success : success,
        error : error
    };
}

function getRecords(record, user){
    if(record[user] == null){
        return record;
    } else {
        return {user : record[user]};
    }
}

function getBuildCount(record, user){
    return (record[user] == null) ? 0 : record[user].builds.length;
}

function setRecord(record, user, mek, pfp, success, error){
    if(record[user] == null){
        record[user] = {
            wallet : user,
            builds : [getAttempt(mek, pfp, success, error)] 
        }
    } else {
        record[user].builds.push(getAttempt(mek, pfp, success, error))
    }
}

async function connectToSolana(){
    console.log("Connecting to Solana");
    // //Solana Stuff
    // let connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'), 'confirmed');

    // let info = await connection.getSupply(new web3.PublicKey("5B1QZJYws1Nnp8Kh3FWVoeQbasr5tJeyiZZnWz8sxDZf"));
    // console.log(info);
}

function spinUpServer(){
    let creditsLeft = 0;
    let record = {};

    //Connect To Solana
    let connection = connectToSolana();

    //Spin Up Server
    app.listen(port, () => console.log(`Listening on port ${port}`));

    //Set Hook
    app.get('/sol/:sol/meka/:meka/pfp/:pfp/scale/:scale', (req, res) => {
        try {
            console.log(`-- Buidling for: ${req.params.sol}...`);
            if(creditsLeft > 0){
                meka.buildMekamount(
                    req.params.sol,
                    req.params.meka,
                    req.params.pfp,
                    parseFloat(req.params.scale),
                    parseInt(getBuildCount(req.params.sol)),
                    (filepath)=> {
                        creditsLeft--;
                        console.log(`-- SUCCESS for: ${req.params.sol}`);
                        setRecord(record, req.params.sol, req.params.meka, req.params.pfp, true, "");
                        res.download(filepath);
                    },
                    (error)=>{
                        console.log(`-- FAIL for: ${req.params.sol} (${error})`);
                        setRecord(record, req.params.sol, req.params.meka, req.params.pfp, false, `(${error})`);
                        res.send({ error: error });
                    }
                );
            } else {
                console.log(`-- No Credits Left for: ${req.params.sol}`);
                res.send({ noCredits: true });
            }
        } catch(error){
            console.log(`-- GLOBAL FAIL for: ${req.params.sol} (${error})`);
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
            fss.readdirSync("./img/")
                .filter(file => file.includes(req.params.clear))
                .map(file => fss.unlinkSync("./img/" + file));
            res.send({ theDeed: "is done" });
            console.log(`-- CLEARED for: ${req.params.clear}`);
        } catch (error) {
            console.log(`Trouble clearing mek (${error})`);
        }
    });

    app.get('/credits/:credits/pass/:pass', (req, res) => {
        try{
            if(req.params.pass == "beep"){
                creditsLeft = (parseInt(req.params.credits) == null) ? 0 : parseInt(req.params.credits);
                res.send({ added: `${req.params.credits} credits` });
            } else {
                res.send({ naughty : "naughty" });
            }
        } catch (error) {
            console.log(`Trouble setting credits (${error})`);
        }
    });

    app.get('/record/:record', (req, res) => {
        try{
            res.send(getRecords(record, req.params.record));
        } catch (error) {
            console.log(`Trouble getting record (${error})`);
        }
    });

}

spinUpServer();