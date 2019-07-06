const express = require('express');
const uuid = require('uuid/v1');
const rp = require('request-promise');
const Blockchain = require('./blockchain');

const app = express();
const nodeAddress = uuid().split('-').join('');

app.use(express.json());

const bitcoin = new Blockchain();

app.get('/blockchain', (req, res) => {
    res.send(bitcoin);
});

app.post('/transaction', (req, res) => {
    const newTransaction = req.body;
    const blockIndex = bitcoin.addTransactionToPendingTransaction(newTransaction);
    res.json({note: `Transaction will be added into block number ${blockIndex}.`});
});

app.post('/transaction/boradcast', (req, res) => {
    const newTransaction = bitcoin.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
    bitcoin.addTransactionToPendingTransaction(newTransaction);

    const requestPromises = []
    bitcoin.networkNodes.forEach(networkNodeUrl => {
        requestOption = {
            uri: networkNodeUrl + '/transaction',
            method: 'POST',
            body: newTransaction,
            json: true
        };

        requestPromises.push(rp(requestOption));
    });

    Promise.all(requestPromises)
        .then(data => {
            res.json({note: 'Transaction created and broadcast successfully.'})
        });
});

//register a node and broadcast it in network
app.post('/register-and-broadcast-node', (req, res) => {
    const newNodeUrl = req.body.newNodeUrl;
    if (bitcoin.networkNodes.indexOf(newNodeUrl) === -1) bitcoin.networkNodes.push(newNodeUrl);

    const regNodePromises = [];
    bitcoin.networkNodes.forEach(networkNodeUrl => {
        //register-node
        const requestOptions = {
            uri: networkNodeUrl + '/register-node',
            method: 'POST',
            body: {newNodeUrl},
            json: true
        };

        regNodePromises.push(rp(requestOptions));
    });

    Promise.all(regNodePromises)
        .then(data => {
            const bulkRegisterOptions = {
                uri: newNodeUrl + '/register-node-bulk',
                method: 'POST',
                body: {allNetworkNodes: [...bitcoin.networkNodes, bitcoin.currentNodeUrl]},
                json: true
            };

            return rp(bulkRegisterOptions);
        })
        .then(data => {
            res.json({note: 'New node registered with network successfully.'})
        });
});

//register a node with network
app.post('/register-node', (req, res) => {
    const newNodeUrl = req.body.newNodeUrl;
    const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(newNodeUrl) === -1;
    const notCurrentNode = bitcoin.currentNodeUrl !== newNodeUrl;
    if (nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(newNodeUrl);
    res.json({note: 'new node registered successfully with node.'})
});

//register multiple nodes at once
app.post('/register-node-bulk', (req, res) => {
    const allNetworkNodes = req.body.allNetworkNodes;

    allNetworkNodes.forEach(networkNodeUrl => {
        const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(networkNodeUrl) === -1;
        const notCurrentNode = bitcoin.currentNodeUrl !== networkNodeUrl;
        if (nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(networkNodeUrl);
    });

    res.json({note: 'Bulk registration successful.'})
});

app.get('/mine', (req, res) => {
    const lastBlock = bitcoin.getLastBlock();
    const previousBlockHash = lastBlock['hash'];
    const currentBlockData = {
        transaction: bitcoin.pendingTransactions,
        index: lastBlock['index'] + 1
    };

    const nounce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);
    const blockHash = bitcoin.hashBlock();

    const newBlock = bitcoin.createNewBlock(nounce, previousBlockHash, blockHash);

    const requestPromises = [];
    bitcoin.networkNodes.forEach(networkNodeUrl => {
        const requestOption = {
            uri: networkNodeUrl + '/receive-new-block',
            method: 'POST',
            body: newBlock,
            json: true
        }

        requestPromises.push(rp(requestOption));
    });

    Promise.all(requestPromises)
        .then(data => {
            const requestOption = {
                uri: bitcoin.currentNodeUrl + '/transaction/broadcast',
                method: 'POST',
                body: {
                    amount: 12.5,
                    sender: "00",
                    recipient: nodeAddress
                },
                json: true
            }

            return rp(requestOption);
        })
        .then(data => {
            res.json({
                note: 'new block mined successfully.',
                block: newBlock
            });
        });

});

app.post('/receive-new-block', (req, res) => {
    const newBlock = req.body.newBlock;
    const lastBlock = bitcoin.getLastBlock();
    const correctHash = lastBlock.hash === newBlock.previousBlockHash;
    const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

    if (correctHash && correctIndex) {
        bitcoin.chain.push(newBlock);
        bitcoin.pendingTransactions = [];
        res.json({note: 'new block received and accepted.', newBlock});
    } else {
        res.json({note: 'new block rejected.', newBlock});
    }
});

app.get('/consensus', (req, res) => {
    const requestPromises = [];
    bitcoin.networkNodes.forEach(networkUrl => {
        const requestOption = {
            uri: networkUrl + '/blockchain',
            method: 'GET',
            json: true
        };
        requestPromises.push(rp(requestOption));
    });

    Promise.all(requestPromises)
        .then(blockchains => {
            const currentChainLength = bitcoin.chain.length;
            let maxChainLength = currentChainLength;
            let newLongestChain = null;
            let newPendingTransactions = null;
            blockchains.forEach(blockchain => {
                if (blockchain.chain.length > maxChainLength) {
                    maxChainLength = blockchain.chain.length;
                    newLongestChain = blockchain.chain;
                    newPendingTransactions = blockchain.pendingTransactions;
                }
                ;
            });

            if (!newLongestChain || (newLongestChain && bitcoin.chainIsValid(newLongestChain))) {
                res.json({note: 'Current chain has not been replaced. ', chain: bitcoin.chain})
            } else if (newLongestChain && bitcoin.chainIsValid(newLongestChain)) {
                bitcoin.chain = newLongestChain;
                bitcoin.pendingTransactions = newPendingTransactions;
                res.json({note: 'this chain has been replaced', chain: bitcoin.chain});
            }
        });
});

app.get('/block/:blockHash', (req, res) => {
    const blockHash = req.body.blockHash;
    const correctBlock = bitcoin.getBlock(blockHash);
    res.json({block: correctBlock})
});

app.get('/transaction/:transactionId', (req, res) => {
    const transactionId = req.body.transactionId;
    const transactionData = bitcoin.getTransaction(transactionId);
    res.json({
        block: transactionData.block,
        transaction: transactionData.transaction
    });
});

app.get('/address/:address', (req, res) => {
    const address = req.body.address;
    const addressData = bitcoin.getAddressData(address);
    res.json({
       addressData
    });
});

const port = process.argv[2];
app.listen(port, () => console.log(`Server start and listen on port ${port}`));