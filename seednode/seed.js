const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../batnode.js').BatNode;
const kad_bat = require('../kad-bat-plugin/kadence_plugin').kad_bat;
const seed = require('../constants').SEED_NODE
const publicIp = require('public-ip');



publicIp.v4().then(ip => {
  console.log(ip, ' is my publicly accessible ip')
  const kademliaNode = new kad.KademliaNode({
    transport: new kad.HTTPTransport(),
    storage: levelup(encoding(leveldown('./db'))),
    contact: seed[1]
  });
  
  
  kademliaNode.identity = seed[0]
  kademliaNode.plugin(kad_bat)
  kademliaNode.listen(80)
  
  
  const batNode = new BatNode(kademliaNode) // create batnode
  kademliaNode.batNode = batNode // tell kadnode who its batnode is
  
   // ask and tell other kad nodes who its batnode is
  
  
   const nodeConnectionCallback = (serverConnection) => {
    serverConnection.on('end', () => {
      console.log('end')
    })
    serverConnection.on('data', (receivedData, error) => {
     receivedData = JSON.parse(receivedData)
     console.log("received data: ", receivedData)
  
  
      if (receivedData.messageType === "RETRIEVE_FILE") {
        batNode.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
         serverConnection.write(data)
        })
      } else if (receivedData.messageType === "STORE_FILE"){
        let fileName = receivedData.fileName
        batNode.kadenceNode.iterativeStore(fileName, [batNode.kadenceNode.identity.toString(), batNode.kadenceNode.contact], (err, stored) => {
          console.log('nodes who stored this value: ', stored)
          let fileContent = new Buffer(receivedData.fileContent)
          batNode.writeFile(`./hosted/${fileName}`, fileContent, (err) => {
            if (err) {
              throw err;
            }
            serverConnection.write(JSON.stringify({messageType: "SUCCESS"}))
          })
        })
      }
    })
  }
  
  
  batNode.createServer(1756, ip, nodeConnectionCallback)

})
