import * as Crypto from "crypto-js";

class Block {
    public index: number;
    public hash: string;
    public previousHash: string | null;
    public data: string;
    public timestamp: number;

    constructor (
        index: number,
        hash: string,
        previousHash: string | null,
        data: string,
        timestamp: number
    ) {
        this.index = index;
        this.hash = hash;
        this.previousHash = previousHash;
        this.data = data;
        this.timestamp = timestamp;
    }
}

// calculateBlockHash
const calculateBlockHash = (
    index: number,
    previousHash: string,
    timestamp: number,
    data: string
): string => Crypto.SHA256(index + previousHash + timestamp + data).toString();

const genesisBlock: Block = new Block(0, "2020202020202", null, "Genesis block", 123456);

const blockchain: Block[] = [genesisBlock];

const getLatestBlock = (): Block => blockchain[blockchain.length - 1];

const addBlock = (data: string): Block => {
    const previousBlock: Block = getLatestBlock();
    const newIndex: number = previousBlock.index + 1;
    const newTimestamp: number = new Date().getTime() / 1000;
    const newHash: string = calculateBlockHash(
        newIndex,
        previousBlock.hash,
        newTimestamp,
        data
    );
    const newBlock: Block = new Block(
        newIndex,
        newHash,
        previousBlock.hash,
        data,
        newTimestamp
    );
    return newBlock;
}

const isValidBlockStructure = (block: Block): boolean => {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'string';
};

const isValidBlock = (candidateBlock: Block, previousBlock: Block): boolean => {
    if (!isValidBlockStructure(candidateBlock)) {
        return false;
    } else if (previousBlock.index + 1 !== candidateBlock.index) {
        return false;
    } else if (previousBlock.hash !== candidateBlock.previousHash) {
        return false;
    } else if (calculateBlockHash(
        candidateBlock.index,
        candidateBlock.previousHash,
        candidateBlock.timestamp,
        candidateBlock.data
    ) !== candidateBlock.hash) {
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
        if (!isValidBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return false;
        }
    }

    return true;
}