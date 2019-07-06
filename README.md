## Introduction

This project is simple blockchain without cryptography in it.
for simplicity this application does not have validation for data inputs. 
it just shows block chain functionality. 
This implementation is in Node.js.

### Install the Dependencies

from the project folder, install the dependencies:

    npm i

### Start the Server
 this application can have multiple node as same machine. if you want to run it in different machine please update package.json and for each node update the address
 I just add 5 nodes into package.json file you can increase it if you want.
 each node can start with 
 
    npm run node_1
    npm run node_2
    npm run node_3
    npm run node_4
    npm run node_5

after running each node you have to register and broadcast each node to the network with below endpoint

    http://localhost:3001/register-and-broadcast-node 

and in postman put the newNodeUrl for example as 

    http://localhost:3002

you have to do this for all running nodes.

for sending transaction into network you have to use the link on one of running servers. it will automatically bradcast the transaction into other nodes in the network:

    http://localhost:3001/transaction/boradcast
    
for the mentioned transaction you must pass: amount, sender address and recipient address
like as 
    
       {
            amount: 100,
            sender: "ab9ab790a01d11e98a8d0346b7d4edbf",
            recipient: "b18f11f0a01d11e98a8d0346b7d4edbf"
       }