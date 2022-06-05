import React, { useEffect, useState } from 'react';
import querystring from 'query-string';
import twitterLogo from './assets/twitter-logo.svg';
import mekaHolder from './assets/meka.png';
import pfpHolder from './assets/pfp.png';
import noot from './assets/noot.png';
import download from 'downloadjs';
import './App.css';

//MUI stuff
import { Fab, Button, Avatar, Tooltip, Grid, Snackbar, Alert, DialogTitle, Dialog } from '@mui/material';
import PropTypes from 'prop-types';
import { createTheme } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMugHot, faCoffeePot, faCoffeeTogo, faPlus, } from '@fortawesome/pro-regular-svg-icons'

//Sol Stuff
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Program, Provider, web3, BN } from '@project-serum/anchor';

import cjkp from './sol/keypair.json' 
import idl from './sol/idl.json';

// SystemProgram is a reference to the Solana runtime!
const { SystemProgram } = web3;

// Create a keypair for the account that will get our coffee jar
const secretArray = Object.values(cjkp._keypair.secretKey);
const secret = new Uint8Array(secretArray);
const honeyPot = web3.Keypair.fromSecretKey(secret);
const coffeeJar = new web3.PublicKey("CiC2Mf4LDhvFFHmqPQiENjmJxP1dNEqdLoRXu2GqEDVF");

// Get our program's id from the IDL file.
const programID = new PublicKey(idl.metadata.address);

// Set our network to devnet.
const network = clusterApiUrl('mainnet-beta');

// Controls how we want to acknowledge when a transaction is "done".
// In product use "finalized"
const opts = {
  preflightCommitment: "processed"
}

//MUI
const muiTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#FF5C38',
    },
  },
  components: {
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: '#FF5C38',
        },
      },
    },
  },
});

// Constants
const REAL_SERVER = '/server';
const TEST_SERVER = '';
const TEST_JSON = '"proxy": "http://localhost:5000"';
const TWITTER_HANDLE = 'CoachChuckFF';
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;
const SERVER_PATH = REAL_SERVER;
const COFFEE_JAR = "CiC2Mf4LDhvFFHmqPQiENjmJxP1dNEqdLoRXu2GqEDVF";

const ALERT_ERROR = "error";
const ALERT_WARNING = "warning";
const ALERT_INFO = "info";
const ALERT_SUCCESS = "success";

const ALERT_TX_TIMEOUT = (60000 * 3);
const ALERT_TIMEOUT = 8000;

const App = () => {
  // State
  const [creditsLeft, setCreditsLeft] = useState(0);
  const [walletAddress, setWalletAddress] = useState(null);
  const [mekAddress, setMekAddress] = useState(null);
  const [pfpAddress, setPfpAddress] = useState(null);
  const [pfpScale, setPfpScale] = useState(0.15);
  const [isMounting, setIsMounting] = useState(false);
  const [isPfpFlipped, setIsPfpFlipped] = useState(false);
  const [isMekFlipped, setIsMekFlipped] = useState(false);
  const [isTwitterCropped, setIsTwitterCropped] = useState(true);
  const [mountCount, setMountCount] = useState(3);
  const [isGettingNFTS, setIsGettingNFTs] = useState(false);
  const [nftList, setNftList] = useState([]);
  const [coffeeCount, setCoffeeCount]     = useState(null);
  const [solCount, setSolCount]           = useState(null);
  const [barista, setBarista]             = useState(null);
  const [coffeeOpen, setCoffeeOpen]       = useState(false);

  const [snackBarOpen, setSnackBarOpen]                 = useState(false);
  const [snackBarMessage, setSnackBarMessage]           = useState('');
  const [snackBarMessageType, setSnackBarMessageType]   = useState('info');
  const [snackBarTimeout, setsnackBarTimeout]           = useState(ALERT_TX_TIMEOUT);
  const [snackBarURL, setSnackBarURL]                   = useState(null);

  // Sol Stuff
  const LAMPORT_COST = 0.000000001
  const numFromRust = (num) => 
  {
    return num.toNumber();
  }
  const numToRust = (num) => 
  {
    return new BN(Math.round(num));
  }
  
  const solTolamports = (sol) => {
    return Math.round(sol / LAMPORT_COST);
  }

  const lamportsToSol = (lamports) => {
    return parseFloat((lamports * LAMPORT_COST).toFixed(5));
  }

  // Actions 
  const getProvider = () => {
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new Provider(
      connection, window.solana, opts.preflightCommitment,
    );
    return provider;
  }

  const loadCoffeeJar = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      console.log("🧮 Tabulating Info...");
      const account = await program.account.coffeeJar.fetch(coffeeJar);

      setCoffeeCount(account.coffeeCount.toNumber());
      setSolCount(lamportsToSol(account.lamportCount));
      setBarista(account.barista.toString());

      console.log("Coffee Count: ", account.coffeeCount.toNumber());
      console.log("Sol Collected: ", lamportsToSol(account.lamportCount).toFixed(2));
      console.log("Barista: ", account.barista.toString());

    } catch (error) {
      console.log("Error getting coffee jar", error);

      setCoffeeCount(null);
      setSolCount(lamportsToSol(null));
      setBarista(null);
    }
  }

  const buyCoffee = async (sol, message, thankYou) => {
    if(sol){
      try {
        const provider = getProvider();
        const program = new Program(idl, programID, provider);

        showSnackBar({
          message: message,
          messageType: ALERT_INFO,
          timeout: ALERT_TX_TIMEOUT,
        });

        let tx = await program.rpc.buyCoffee(
          numToRust(solTolamports(sol)),
          {
            accounts: {
              coffeeJar: coffeeJar,
              from: provider.wallet.publicKey,
              to: barista,
              systemProgram: SystemProgram.programId,
            },
            signers: [provider.wallet.Keypair]
          }
        );

        console.log(tx);

        showSnackBar({
          message: thankYou,
          messageType: ALERT_SUCCESS,
          timeout: ALERT_TX_TIMEOUT,
          url: `https://solscan.io/tx/${tx}`
        });

        await loadCoffeeJar();
      } catch (error) {
        console.log("ERROR");
        showSnackBar({
          message: "Oh no! Solana spilled the coffee! Oh well! I appreciate the thought!",
          messageType: ALERT_ERROR,
        });
      }
    }
  }

  const createCoffeeJar = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      showSnackBar({
        message: "☕ Crafting Coffee Jar...",
        messageType: ALERT_INFO,
        timeout: ALERT_TX_TIMEOUT,
      });
      await program.rpc.startCoffeeJar({
        accounts: {
          coffeeJar: honeyPot.publicKey,                //Web  keypair
          barista: provider.wallet.publicKey,             //User keypair
          systemProgram: SystemProgram.programId,
        },
        signers: [honeyPot, provider.wallet.Keypair], //even though the barista is the payer, the coffeejar needs to sign this
      });  

      showSnackBar({
        message: "☕ Crafted!",
        messageType: ALERT_SUCCESS,
      });

      await loadCoffeeJar();
    } catch (error) {
      showSnackBar({
        message: "Error creating coffeejar",
        messageType: ALERT_ERROR,
      });
    }
  }

  const checkIfWalletIsConnected = async () => {
    connectWallet({onlyIfTrusted: true});
  };

  const connectWallet = async ({onlyIfTrusted = false}) => {
    try {
      const { solana } = window;

      if (solana) {
        if (solana.isPhantom) {
          const response = await solana.connect({ onlyIfTrusted: onlyIfTrusted });

          // showSnackBar({
          //   message: "Connected Phantom Wallet! 👻",
          //   messageType: ALERT_INFO
          // });

          setWalletAddress(response.publicKey.toString());
        }
      } else {
        showSnackBar({
          message: "Solana object not found! Get a Phantom Wallet 👻",
          messageType: ALERT_ERROR
        });
      }
    } catch (error) {
      console.error(`Error checking wallet [${error}]`);
    }
  };
  
  // UseEffects
  useEffect(() => {
    const onLoad = async () => {
      await checkIfWalletIsConnected();
      await getCreditsLeft();
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);
  
  useEffect(() => {
    if (walletAddress) {
      console.log('Fetching NFTs...');
      
      // Call Solana program here.
      loadCoffeeJar();
      grabAllNFTs();
  
      // Set state
      // setGifList(TEST_GIFS);
    }
  }, [walletAddress]);

  // COFFEE
  const buyACoffeeForCoach = () => {
    if(coffeeCount == null && walletAddress != null){
      createCoffeeJar();
    } else {
      handleClickOpen();
    }
  }

  const buyFancyCoffee = () => {
    buyCoffeeWithSol(0.13, "Brewing... A Fancy Coffee!", "Wow a fancy coffee?!? Oh you 🤗");
  }

  const buyCoffeePot = () => {
    buyCoffeeWithSol(0.08, "Brewing... A Pot-o-Coffee!", "A whole pot of coffee?! Thank you!");
  }

  const buyCoffeeCup = () => {
    buyCoffeeWithSol(0.05, "Brewing... A Cup of Coffee!", "A cup of coffee! Thank you anon!");
  }

  const buyCoffeeWithSol = (sol, message, thankYou) => {
    if(walletAddress != null){
      buyCoffee(sol, message, thankYou);
    } else {
      showSnackBar({
        message: 'Connect your wallet first!',
        messageType: ALERT_WARNING,
      });
      connectWallet({onlyIfTrusted: false});
    }
  }

  // Web Stuff
  const getURLData = (baseURL = '', path = '', params = {}) => {
    let requestedURL = baseURL + path + ((params.length == 0) ? "" : "?" + querystring.stringify(params));
    return new Promise((resolve, reject) => {
      fetch(requestedURL, {
        method: 'GET',
        cache: 'no-cache',
        headers: {'accept': 'application/json'},
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
      }).then((response) => {
        response.json().then((data)=>{
          resolve(data);
        })
        .catch((error) => {reject(`Could not get JSON (${requestedURL})`);});
      })
      .catch((error) => {reject(`Could not get URL (${requestedURL})`);});
    });
  }

  const grabAllNFTs = () => {
    if(!isGettingNFTS){
      setIsGettingNFTs(true);
      getURLData(
        "https://public-api.solscan.io",
        "/account/tokens",
        { account: `${walletAddress}`,},
      ).then((data) => {

        //Grab NFT Tokens
        let promises = [];
        data.forEach(token => {
          if(token.tokenAmount != null && token.tokenAmount.amount == 1 && token.tokenAmount.decimals == 0){
          
            promises.push(
              new Promise((resolve, reject)=>{
                setTimeout(() => {
                  getURLData(
                    "https://public-api.solscan.io",
                    `/account/${token.tokenAddress}`,
                  ).then((data)=>{
                    resolve(data);
                  })
                  .catch((error)=>{
                    resolve({});
                  })
                }, Math.random() * 100)
              })

            );
          }
        });

        if(promises.length > 50) {
          alert(`You have ${promises.length} NFTs in your wallet - this will probably go over the solscan pubplic API limit`)
        }

        // Get Metadata on all
        Promise.all(promises)
        .then((nfts)=>{
          
          //Grab only the useful stuff
          let nftMetadata = [];
          console.log(nfts)
          nfts.forEach(nft=> {
            try{
              if(nft.metadata == null){throw new Error('No metadata');}
              if(nft.metadata.data.name == null){throw new Error('No name!');}
              if(nft.metadata.data.collection == null && nft.tokenInfo.symbol == null){throw new Error(nft.metadata.data.name + " Bad collection");}
              if(nft.metadata.data.image == null){throw new Error(nft.metadata.data.name + " Bad image");}
              if(nft.account == null){throw new Error(nft.metadata.data.name + " Bad account");}

              //Fuck Collections
              let collection = null;
              if(nft.metadata.data.collection != null){
                if(typeof nft.metadata.data.collection === 'string'){
                  collection = nft.metadata.data.collection;
                } else {
                  collection = nft.metadata.data.collection.name;
                }
              }
              if(collection == null) collection = nft.tokenInfo.symbol;
              if(collection == null) throw new Error(nft.metadata.data.name + " Bad collection... Again");

              nftMetadata.push(
                {
                  name : nft.metadata.data.name, 
                  collection : collection,
                  url : nft.metadata.data.image,
                  address : nft.account,
                }
              );
            } catch (error){
              console.log(error);
            }
          });

          //Sort
          nftMetadata.sort((a, b)=>{
            return a.collection.localeCompare(b.collection);
          });

          // showSnackBar({
          //   message: 'Got all NFTs!',
          //   messageType: ALERT_SUCCESS,
          // });

          //Update
          setNftList(nftMetadata);
          setIsGettingNFTs(false);
        })
        .catch((error) => {
          showSnackBar({
            message: 'Error Could not grab ALL NFTs',
            messageType: ALERT_ERROR,
          });
          console.log(error);
          setIsGettingNFTs(false);
        })

      })
      .catch((error) => {
        showSnackBar({
          message: 'Error Could not grab ALL NFTs',
          messageType: ALERT_ERROR,
        });
        console.log(error);
        setIsGettingNFTs(false);
      })
    } else {
      console.log("Crawling...")
    }
  }

  const getCreditsLeft = async () => {
    try {
      const response = await fetch(`${SERVER_PATH}/credits`);
      const data = await response.json();
      setCreditsLeft(data.credits);
    } catch {
      console.log("Could not grab credits");
    }
  }

  const nukeIMG = async () => {
    try {
      const response = await fetch(`${SERVER_PATH}/nuke/${walletAddress}`);
      const data = await response.json();
    } catch {
      console.log("Could not nuke img");
    }
  }

  const isChosenMek = (nft) => {isChosenImg(nft, mekAddress)}
  const isChosenPFP = (nft) => {isChosenImg(nft, pfpAddress)}
  const isChosenImg = (nft, slot) => {
    if(slot == null) return false;
    if(nft == null) return false;
    return nft.address == slot.address;
  }

  const getMekaName = () => {
    let mek = (mekAddress == null) ? null : mekAddress.name;
    let pfp = (pfpAddress == null) ? null : pfpAddress.name;

    let name = (mek == null) ? ' ' : 'Meka-';
    name += (pfp == null) ? ' ' : pfp.split(' ')[0];
    return name;
  }

  const downloadNewMek = async () => {
    if(creditsLeft <= 0){
      showSnackBar({
        message: `No more community credits! Ask @Coach Chuck for more`,
        messageType: ALERT_WARNING
      });
    } else if(mountCount <= 0){
      showSnackBar({
        message: `No more mounts! (But... you could refresh...)`,
        messageType: ALERT_WARNING
      });
    } else if(mekAddress == null || pfpAddress == null){
      showSnackBar({
        message: 'Need to pick both a Mekamount and PFP',
        messageType: ALERT_WARNING
      });
    } else if(!isMounting){
      showSnackBar({
        message: 'Mounting...',
        messageType: ALERT_INFO,
        timeout: ALERT_TX_TIMEOUT,
      });
      setIsMounting(true);
      try {
        const response = await fetch(`${SERVER_PATH}/sol/${walletAddress}/meka/${mekAddress.address}/mekaflip/${isMekFlipped}/pfp/${pfpAddress.address}/pfpflip/${isPfpFlipped}/twittercrop/${isTwitterCropped}/scale/${pfpScale}`);
        const blob = await response.blob();

        if(blob.size < 500){
          const data = await response.json();
          if(data.error != null){
            showSnackBar({
              message: `Error mounting mek [${data.error}]`,
              messageType: ALERT_ERROR
            });
          } else {
            showSnackBar({
              message: "Error mounting mek [UNKNOWN]",
              messageType: ALERT_ERROR
            });
          }
        } else {
          download(blob, getMekaName() + ".png");
          setMountCount(mountCount - 1);
          getCreditsLeft();
          nukeIMG();
          showSnackBar({
            message: `LOCK AND LOAD!`,
            messageType: ALERT_SUCCESS
          });
        }

      } catch (error) {
        showSnackBar({
          message: `Error mounting mek [${error}]`,
          messageType: ALERT_ERROR
        });
      }

      setIsMounting(false);
    } else {
      showSnackBar({
        message: "Still Mounting...",
        messageType: ALERT_WARNING,
      });
    }
  };

  // Popups
  const redirectToTwitter = () => {
    window.open(TWITTER_LINK, '_blank');
  }

  //Snackbar
  const showSnackBar = ({message = "Hi there", messageType = ALERT_INFO, timeout = ALERT_TIMEOUT, url = null}) => {
    setCoffeeOpen(false);
    setsnackBarTimeout(timeout)
    setSnackBarMessage(message);
    setSnackBarMessageType(messageType);
    setSnackBarURL(url);
    setSnackBarOpen(true);
  };

  const closeSnackBar = () => {
    setSnackBarOpen(false);
  }

  const handleSnackBarClose = () => {
    closeSnackBar();
  };

  function MessageSnackbar(props) {
    const { onClose, open, message, messageType, timeout, url } = props;
  
    const handleClose = () => {
      onClose();
    };

    const typeToSeverity = (type) => {
      switch(type) {
        case "error": return type;
        case "warning": return type;
        case "info": return type;
        case "success": return type;
      }
      return "info";
    }

    const typeToColor = (type) => {
      switch(type) {
        case "error": return "#60291E";
        case "warning": return "#603A1D";
        case "info": return "#20515B";
        case "success": return "#2C6036";
      }

      return "#20515B";
    }

    const goToURL = () => {
      if(url != null){
    window.location.href = TWITTER_LINK; 

        window.location.href = url;
      } else {
        console.log("hi");
      }
    }
  
    const alert = (
        <Alert variant="filled" severity={typeToSeverity(messageType)} sx={{backgroundColor: typeToColor(messageType)}} onClick={goToURL}>
          {message}
          {(url != null) ? <div style={{width: 5}}></div> : <div></div>}
          {(url != null) ? <a target="_blank" className='tx-link' href={url}>(See Transaction)</a> : <div></div>}
        </Alert>
    );
  
    return (
      <div>
        <Snackbar
          open={open}
          autoHideDuration={timeout}
          onClose={handleClose}
        >{alert}</Snackbar>
      </div>
    );
  }

  MessageSnackbar.propTypes = {
    onClose: PropTypes.func.isRequired,
    open: PropTypes.bool.isRequired,
    messageType: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
    timeout: PropTypes.number.isRequired,
    url: PropTypes.string.isRequired,
  };

  //Dialog
  const handleClickOpen = () => {
    closeSnackBar();
    setCoffeeOpen(true);
  };

  const handleClose = () => {
    setCoffeeOpen(false);
  };

  function BuyCoachACoffeePopup(props) {
    const { onClose, open } = props;

    const handleClose = () => {
      onClose();
    };
  
    return (
      <Dialog 
        onClose={handleClose} 
        open={open} 
        theme={muiTheme}
        PaperProps={{
          style: {
            backgroundColor: '#3E3E3E',
            boxShadow: 'none',
          },
        }}
      >
        <DialogTitle sx={{color: '#FAFAFA', textAlign: 'center'}}>Buy Coach a Coffee!</DialogTitle>
        <center>
          <Tooltip title="Noot Noot!">
            <Avatar alt="Coach Chuck" src={noot} sx={{ width: 89, height: 89, marginBottom: 2, boxShadow: 5}} onClick={redirectToTwitter}/>
          </Tooltip>
        </center>
        <center>
        <Tooltip title={(solCount == null) ? 'Connect Wallet' : `${solCount.toFixed(2)} ◎`}>
          <div>
            <a className="little-text" href='https://solscan.io/account/7RawqnUsUxA8pnb8nAUTgyzRaLVRYwR9yzPR3gfzbdht' target='_blank'>
              <p>
                {'Address: ' + '7RawqnUsUxA8pnb8nAUTgyzRaLVRYwR9yzPR3gfzbdht'.substring(0, 8) + '...'}
              </p>
            </a>
            <a className="little-text" href='https://solscan.io/account/CiC2Mf4LDhvFFHmqPQiENjmJxP1dNEqdLoRXu2GqEDVF' target='_blank'>
              <p>
                Caffine Units Given: {(coffeeCount == null) ? '⏳' : `${coffeeCount}!`}
              </p>
            </a>
          </div>
        </Tooltip>
        </center>
        <Grid container spacing={0}>
            <Grid item xs={4}>
            <Tooltip title="+ 1 Fancy 😍 (0.13 ◎)">
                <Button theme={muiTheme} sx={{padding: 2, margin: 1}} variant="contained" onClick={buyFancyCoffee}>
                  <FontAwesomeIcon icon={faPlus} size="lg" className='fa-color'/>
                  <div style={{width: 5}}></div>
                  <FontAwesomeIcon icon={faCoffeeTogo} size="lg" className='fa-color'/>
                </Button>
              </Tooltip>
            </Grid>
            <Grid item xs={4}>
              <Tooltip title="+ 1 Pot ✨ (0.05 ◎)">
                <Button theme={muiTheme} sx={{padding: 2, margin: 1}} variant="contained" onClick={buyCoffeePot}>
                  <FontAwesomeIcon icon={faPlus} size="lg" className='fa-color'/>
                  <div style={{width: 5}}></div>
                  <FontAwesomeIcon icon={faCoffeePot} size="lg" className='fa-color'/>
                </Button>
              </Tooltip>
            </Grid>
            <Grid item xs={4}>
            <Tooltip title="+ 1 Cup ❤️ (0.03 ◎)">
                <Button theme={muiTheme} sx={{padding: 2, margin: 1}} variant="contained" onClick={buyCoffeeCup}>
                  <FontAwesomeIcon icon={faPlus} size="lg" className='fa-color'/>
                  <div style={{width: 5}}></div>
                  <FontAwesomeIcon icon={faMugHot} size="lg" className='fa-color'/>
                </Button>
              </Tooltip>
            </Grid>
          </Grid>
      </Dialog>
    );
  }

  BuyCoachACoffeePopup.propTypes = {
    onClose: PropTypes.func.isRequired,
    open: PropTypes.bool.isRequired,
  };

  // Renders
  const selectNFT = (nft) => {

    if(nft.name.includes("Mekamounts")){
      setMekAddress(nft);
    } else {
      setPfpAddress(nft);
    }
    
  }

  const mekSort = (nft) => {return nft.name.includes("Mekamounts");}
  const pfpSort = (nft) => {return !nft.name.includes("Mekamounts");}
  const getPFPList = (sortFunction) => {return nftList.filter(sortFunction);}

  const renderNFTContainer = () => (
    <div>
      <a target="_blank" href='https://www.magiceden.io/marketplace/mekamounts' className='file-name'><p>{getPFPList(mekSort).length > 0 ? "Choose your Mekamount..." : "You have no Mekamounts... "}</p></a>
      <div className="gif-grid">
        {getPFPList(mekSort).map((nft) => (
          <div className={"gif-item"} key={nft.url} onClick={() => {selectNFT(nft)}}>
            <div className='overlay'>
              <img src={nft.url} alt={nft.url}/>
              <div className={(mekAddress == null) ? 'selection-overlay' : ((mekAddress.address != nft.address) ? 'selection-overlay' : 'selected')}></div>
            </div>
            <p className="sub-text">{nft.name}</p>
            <div className='mini-spacing'></div>
          </div>
        ))}
      </div>
      <a target="_blank" href='https://www.magiceden.io/marketplace/pesky_penguins' className='file-name'><p>{getPFPList(pfpSort).length > 0 ? "Choose your PFP..." : "You have no PFPs..."}</p></a>
      <div className="gif-grid">
        {getPFPList(pfpSort).map((nft) => (
          <div className={"gif-item"} key={nft.url} onClick={() => {selectNFT(nft)}}>
            <div className='overlay'>
              <img src={nft.url} alt={nft.url}/>
              <div className={(pfpAddress == null) ? 'selection-overlay' : ((pfpAddress.address != nft.address) ? 'selection-overlay' : 'selected')}></div>
            </div>
            <p className="sub-text">{nft.name}</p>
            <div className='mini-spacing'></div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderLoadingContainer = () => (
    <p className="file-name">Loading NFTs...</p>
  );

  const renderTwitterCropSwitch = () => (
    <div className="toggle-switch">
      <p>Crop for Twitter [{`${isTwitterCropped}`}]</p>
      <label className="switch">
        <input 
          type="checkbox" 
          checked={isTwitterCropped}
          onChange={()=>setIsTwitterCropped(!isTwitterCropped)}
        />
        <span className="slider round"></span>
      </label>
    </div>
  );

  const renderConnectedContainer = () => (
    <div className="connected-container">
        <div className="selected-grid">
        {<div className="selected-item" key={"meka"}>
          <div className='flip-container' onClick={() => {setIsMekFlipped(!isMekFlipped);}}>
            <div className={isMekFlipped ? 'is-flipped' : 'can-flip'}>
              <img src={mekAddress == null ? mekaHolder : mekAddress.url} alt={mekaHolder} />
              <p className="sub-text">{mekAddress == null ? "" : "Mekamount"}</p>
            </div>
          </div>
        </div>}
        {<div className="selected-item" key={"pfp"}>
        <div className='flip-container' onClick={() => {setIsPfpFlipped(!isPfpFlipped);}}>
            <div className={isPfpFlipped ? 'is-flipped' : 'can-flip'}>
              <img src={pfpAddress == null ? pfpHolder : pfpAddress.url} alt={pfpHolder} />
              <p className="sub-text">{pfpAddress == null ? "" : "PFP"}</p>
            </div>
          </div>
        </div>}
      </div>
      <div className='mini-spacing'></div>
      <p className="sub-text file-name">{(mekAddress == null || pfpAddress == null) ? getMekaName() : getMekaName()}</p>
      {renderTwitterCropSwitch()}
      <button type="submit" className="cta-button submit-gif-button" onClick={downloadNewMek} disabled={isMounting}>
        {(isMounting ? `Mounting...` : `Mount [${mountCount}]`)}
      </button>
      <div className='spacing'></div>
      <p className="sub-text">For loading NFTs - it's best to move your Mek and PFP to a burner wallet</p>
      {(isGettingNFTS) ? renderLoadingContainer() : renderNFTContainer()}
      <div className='spacing'></div>
    </div>
  );

  const renderNotConnectedContainer = () => (
    <button
      className="cta-button connect-wallet-button"
      onClick={connectWallet}
    >
      Connect to Wallet
    </button>
  );

  // Main Page
  return (
    <div className="App">
			{/* This was solely added for some styling fanciness */}
			<div className={walletAddress ? 'authed-container' : 'container'}>
        <div className="header-container">
          <p className="header">🦾 Mekamount PFP Portal 🐦</p>
          <p className="header">[CR Left: {creditsLeft}]</p>
          <p className="sub-text">
            N F T ✨
          </p>
          {!walletAddress && renderNotConnectedContainer()}
          {/* We just need to add the inverse here! */}
          {walletAddress && renderConnectedContainer()}
        </div>
        <div className='spacing'></div>
        <div className="footer-container">
          <img alt="Twitter Logo" className="twitter-logo" src={twitterLogo} />
          <a
            target="_blank"
            className="footer-text twitter-link"
            href={TWITTER_LINK}
            rel="noreferrer"
          >{`Another @${TWITTER_HANDLE} Production`}</a>
        </div>
      </div>
      {/* <div className='fab'>
        <Fab color="primary" aria-label="buy" variant="extended" theme={muiTheme} onClick={buyACoffeeForCoach}>
          <FontAwesomeIcon icon={faPlus} size="xl" className='fa-color'/>
          <div style={{width: 5}}></div>
          <FontAwesomeIcon icon={faMugHot} size="xl" className='fa-color'/>
        </Fab>
      </div> */}
      {/* <BuyCoachACoffeePopup
        open={coffeeOpen}
        onClose={handleClose}
      /> */}
      <MessageSnackbar
        open={snackBarOpen}
        onClose={handleSnackBarClose}
        messageType={snackBarMessageType}
        message={snackBarMessage}
        timeout={snackBarTimeout}
        url={snackBarURL}
      />
    </div>
  );
};

export default App;