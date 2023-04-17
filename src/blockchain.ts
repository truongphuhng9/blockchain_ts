import * as Crypto from "crypto-js"
import * as _ from "lodash"

import { broadcastLatest } from "./p2p"
import { hexToBinary } from "./utils"
import { Transaction, UnspentTxOut, getCoinbaseTransaction, isValidAddress, processTransactions } from "./transaction"
import { createTransaction, getBalance, getPrivateKeyFromWallet, getPublicFromWallet } from './wallet'
import { getTransactionPool, addToTransactionPool } from './transactionPool'
// in seconds
const BLOCK_GENERATION_INTERVAL: number = 10

// in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10

class Block {
    public index: number
    public hash: string
    public previousHash: string | null
    public data: Transaction[]
    public timestamp: number
    public difficulty: number
    public nonce: number

    constructor (
        index: number,
        hash: string,
        previousHash: string | null,
        data: Transaction[],
        timestamp: number,
        difficulty: number,
        nonce: number
    ) {
        this.index = index;
        this.hash = hash;
        this.previousHash = previousHash;
        this.data = data;
        this.timestamp = timestamp;
        this.difficulty = difficulty
        this.nonce = nonce
    }
}

// calculateBlockHash
const calculateHash = (
    index: number,
    previousHash: string,
    timestamp: number,
    data: Transaction[],
    difficulty: number,
    nonce: number
    
): string => Crypto.SHA256(index + previousHash + timestamp + data + difficulty + nonce).toString()

const calculateHashForBlock = (block: Block): string => {
    return calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce)
}

const genesisBlock: Block = new Block(0, "2020202020202", '', [], 123456, 0, 0)

let blockchain: Block[] = [genesisBlock]

let unspentTxOuts: UnspentTxOut[] = []

const getBlockchain = (): Block[] => blockchain

const getLatestBlock = (): Block => blockchain[blockchain.length - 1]

const getUnspentTxOuts = (): UnspentTxOut[] => _.cloneDeep(unspentTxOuts)

const getDifficuty = (aBlockchain: Block[]): number => {
    const latestBlock: Block = aBlockchain[blockchain.length - 1]
    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
        return getAdjustedDifficulty(latestBlock, aBlockchain)
    } else {
        return latestBlock.difficulty
    }
}

const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
    const prevAdjustmentBlock: Block = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL]
    const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL
    const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentBlock.difficulty + 1
    } else if (timeTaken > timeExpected * 2) {
        return prevAdjustmentBlock.difficulty - 1
    } else {
        return prevAdjustmentBlock.difficulty
    }
}

const getCurrentTimestamp = () => Math.round(new Date().getTime()/1000)

const getAccummulateDifficulty = (aBlockchain: Block[]): number => {
    return aBlockchain
        .map((block) => block.difficulty)
        .map((difficulty) => Math.pow(2, difficulty))
        .reduce((a, b) => a + b)
}

const generateRawNextBlock = (data: Transaction[]): Block => {
    const previousBlock: Block = getLatestBlock()
    const difficulty: number = getDifficuty(getBlockchain())
    const newIndex: number = previousBlock.index + 1
    const newTimestamp: number = getCurrentTimestamp()
    const newBlock: Block = findBlock(newIndex, previousBlock.hash, newTimestamp, data, difficulty)
    if (addBlockToChain(newBlock)) {
        broadcastLatest()
        return newBlock
    } else {
        return null
    }
}

const generateNextBlock = () => {
    const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1)
    const blockData: Transaction[] = [coinbaseTx]
    return generateRawNextBlock(blockData)
}

const generateNextBlockWithTransaction = (receiverAddress: string, amount: number) => {
    if (!isValidAddress(receiverAddress)) {
        throw Error('invalid address')
    }
    if (typeof amount !== 'number') {
        throw Error('invalid amount')
    }

    const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1)
    const tx: Transaction = createTransaction(receiverAddress, amount, getPrivateKeyFromWallet(), getUnspentTxOuts(), getTransactionPool())
    const blockData: Transaction[] = [coinbaseTx, tx]

    return generateRawNextBlock(blockData)
}

const getAccountBalance = (): number => {
    return getBalance(getPublicFromWallet(), unspentTxOuts)
}

const sendTransaction = (address: string, amount: number) => {
    const tx: Transaction = createTransaction(address, amount, getPrivateKeyFromWallet(), getUnspentTxOuts(), getTransactionPool()) 
    addToTransactionPool(tx, getUnspentTxOuts())
    return tx
}

const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
    const hashInBinary: string = hexToBinary(hash)
    const requiredPrefix: string = '0'.repeat(difficulty)
    return hashInBinary.startsWith(requiredPrefix)
}

const findBlock = (index: number, previousHash: string, timestamp: number, data: Transaction[], difficulty: number): Block => {
    let nonce = 0
    while (true) {
        const hash: string = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Block(index, hash, previousHash, data, timestamp, difficulty, nonce);
        }
        nonce++;
    }
}

const addBlockToChain = (newBlock: Block) => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        const retVal: UnspentTxOut[] = processTransactions(newBlock.data, unspentTxOuts, newBlock.index)
        if (retVal === null) {
            return false
        } else {
            blockchain.push(newBlock);
            unspentTxOuts = retVal
            return true
        }
    }
    return false
}

const hasValidHash = (block: Block): boolean => {
    if (!hashMatchesBlockContent(block)) {
        console.log('invalid hash, got: ' + block.hash)
        return false
    }

    if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
        console.log('block difficulty not satisfied. Expected: ' + block.difficulty + 'got: ' + block.hash)
        return false
    }
    return true 
}

const isValidTimestamp = (block: Block, previousBlock: Block): boolean => {
    return (previousBlock.timestamp - 60 < block.timestamp) && (block.timestamp - 60 < getCurrentTimestamp())
}

const hashMatchesBlockContent = (block: Block): boolean => {
    const blockHash: string = calculateHashForBlock(block)
    return block.hash === blockHash
}

const isValidBlockStructure = (block: Block): boolean => {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'object';
}

const isValidNewBlock = (candidateBlock: Block, previousBlock: Block): boolean => {
    if (!isValidBlockStructure(candidateBlock)) {
        console.log("The candidate block structure is not valid");
        return false;
    }

    if (previousBlock.index + 1 !== candidateBlock.index) {
        return false;
    } else if (previousBlock.hash !== candidateBlock.previousHash) {
        return false;
    } else if (!isValidTimestamp(candidateBlock, previousBlock)) {
        return false;
    } else if (!hasValidHash(candidateBlock)) {
        return false;
    } else {
        return true;
    }
}

const isValidChain = (blockchainToValidate: Block[]): boolean => {
    const isValidGenesis = (block: Block): boolean => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    }

    if (!isValidGenesis(blockchainToValidate[0])) {
        return false;
    }

    for (let i = 1; i < blockchainToValidate.length; i++) {
        if (!isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return false;
        }
    }

    return true;
}

const replaceChain = (newChain: Block[]): void => {
    if (isValidChain(newChain) &&
        getAccummulateDifficulty(newChain) > getAccummulateDifficulty(getBlockchain())) {
        console.log("Received blockchain is valid. Replacing current blockchain with received blockchain");
        blockchain = newChain;
        broadcastLatest()
    } else {
        console.log("Received blockchain is not valid. Do nothing");
    }
}

export { Block, getLatestBlock, getBlockchain, getAccountBalance,
    generateNextBlock, generateRawNextBlock, generateNextBlockWithTransaction,
    isValidBlockStructure, isValidNewBlock, isValidChain, replaceChain, 
    addBlockToChain, sendTransaction };