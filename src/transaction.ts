import * as Crypto from 'crypto-js'
import * as ecdsa from 'elliptic'
import * as _ from 'lodash'

import { toHexString } from './utils'


const ec = new ecdsa.ec('secp256k1')

const COINBASE_AMOUNT = 50

class TxOut {
    public address: string
    public amount: number

    constructor(address: string, amount: number) {
        this.address = address
        this.amount = amount
    }
}

class TxIn {
    public txOutId: string
    public txOutIndex: number
    public signature: string
}

class Transaction {
    public id: string
    public txIns: TxIn[]
    public txOuts: TxOut[]
}

class UnspentTxOut {
    public readonly txOutId: string
    public readonly txOutIndex: number
    public readonly address: string
    public readonly amount: number

    constructor(txOutId: string, txOutIndex: number, address: string, amount: number) {
        this.txOutId = txOutId
        this.txOutIndex = txOutIndex
        this.address = address
        this.amount = amount
    }
}


const findUnspentTxOut = (transactionId: string, index: number, aUnspentTxOuts: UnspentTxOut[]): UnspentTxOut | undefined => {
    return aUnspentTxOuts.find((uTxO) => uTxO.txOutId === transactionId && uTxO.txOutIndex === index)
}

const getTxInAmount = (txIn: TxIn, aUnspentTxOuts: UnspentTxOut[]): number | undefined => {
    return findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts)?.amount
}

const updateUnspentTxOuts = (newTransactions: Transaction[], aUnspentTxOuts: UnspentTxOut[]): UnspentTxOut[] => {
    const newUnspentTxOuts: UnspentTxOut[] = newTransactions
        .map((t) => {
            return t.txOuts.map((txOut, index) => new UnspentTxOut(t.id, index, txOut.address, txOut.amount))
        })
        .reduce((a, b) => a.concat(b), [])

    const consumedTxOuts: UnspentTxOut[] = newTransactions
        .map((t) => t.txIns)
        .reduce((a, b) => a.concat(b), [])
        .map((txIn) => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0))

    const resultingUnspentTxOuts = aUnspentTxOuts
        .filter((uTxO) => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts))
        .concat(newUnspentTxOuts)

    return resultingUnspentTxOuts
}

const processTransactions = (aTransactions: Transaction[], aUnspentTxOuts: UnspentTxOut[], blockIndex: number) => {
    if (!isValidTransactionsStructure(aTransactions)) {
        return null
    }

    if (!validateBlockTransactions(aTransactions, aUnspentTxOuts, blockIndex)) {
        console.log('invalid block transaction')
    }

    return updateUnspentTxOuts(aTransactions, aUnspentTxOuts)
}

const getTransactionId = (transaction: Transaction): string => {
    const txInContent: string = transaction.txIns
        .map((txIn: TxIn) => txIn.txOutId + txIn.txOutIndex)
        .reduce((a, b) => a + b, '')

    const txOutContent: string = transaction.txOuts
        .map((txOut: TxOut) => txOut.address + txOut.amount)
        .reduce((a, b) => a + b, '')

    return Crypto.SHA256(txInContent + txOutContent).toString()
}

const getPublicKey = (aPrivateKey: string): string => {
    return ec.keyFromPrivate(aPrivateKey, 'hex').getPublic().encode('hex')
}

const signTxIn = (transaction: Transaction, txInIndex: number, privateKey: string, aUnspentTxOuts: UnspentTxOut[]): string => {
    const txIn: TxIn = transaction.txIns[txInIndex]
    const dataToSign = transaction.id
    const referencedUnspentTxOut: UnspentTxOut = findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts)
    if (referencedUnspentTxOut == null) {
        console.log('could not find referenced txOut')
        throw Error()
    }
    
    const referencedAddress = referencedUnspentTxOut.address
    if (getPublicKey(privateKey) !== referencedAddress) {
        console.log('trying to sign an input with private' +
            ' key that does not match the address that is referenced in txIn')
        throw Error()
    }
    const key = ec.keyFromPrivate(privateKey, 'hex')
    const signature: string = toHexString(key.sign(dataToSign).toDER())
    return signature
}

const getCoinbaseTransaction = (address: string, blockIndex: number): Transaction => {
    const t = new Transaction()
    const txIn: TxIn = new TxIn()
    txIn.signature = ""
    txIn.txOutId = ""
    txIn.txOutIndex = blockIndex

    t.txIns = [txIn]
    t.txOuts = [new TxOut(address, COINBASE_AMOUNT)]
    t.id = getTransactionId(t)
    return t
}

const isValidTxInStructure = (txIn: TxIn): boolean => {
    if (txIn == null) {
        console.log('txIn is null')
        return false
    } else if (typeof txIn.signature !== 'string') {
        console.log('invalid signature type in txIn')
        return false
    } else if (typeof txIn.txOutId !== 'string') {
        console.log('invalid txOutId type in txIn')
        return false
    } else if (typeof  txIn.txOutIndex !== 'number') {
        console.log('invalid txOutIndex type in txIn')
        return false
    } else {
        return true
    }
}

const isValidTxOutStructure = (txOut: TxOut): boolean => {
    if (txOut == null) {
        console.log('txOut is null');
        return false;
    } else if (typeof txOut.address !== 'string') {
        console.log('invalid address type in txOut');
        return false;
    } else if (!isValidAddress(txOut.address)) {
        console.log('invalid TxOut address');
        return false;
    } else if (typeof txOut.amount !== 'number') {
        console.log('invalid amount type in txOut');
        return false;
    } else {
        return true;
    }
};


const validateTransaction = (transaction: Transaction, aUnspentTxOuts: UnspentTxOut[]): boolean => {
    if (getTransactionId(transaction) != transaction.id) {
        console.log('invalid tx id: ' + transaction.id)
        return false
    }
    const hasValidTxIns: boolean = transaction.txIns
        .map((txIn) => validateTxIn(txIn, transaction, aUnspentTxOuts))
        .reduce((a, b) => a && b, true)

    if (!hasValidTxIns) {
        console.log('some of the txIns are invalid in tx: ' + transaction.id)
        return false
    }

    const totalTxInValues: number = transaction.txIns
        .map((txIn) => getTxInAmount(txIn, aUnspentTxOuts))
        .reduce((a, b) => (a + b), 0)

    const totalTxOutValues: number = transaction.txOuts
        .map((txOut) => txOut.amount)
        .reduce((a, b) => (a + b), 0)

    if (totalTxOutValues !== totalTxInValues) {
        console.log('totalTxOutValues !== totalTxInValues in tx: ' + transaction.id)
        return false
    }
    return true
}

const validateCoinbaseTx = (transaction: Transaction, blockIndex: number): boolean => {
    if (transaction == null) {
        console.log('the first transaction must be a conibase transaction')
        return false
    }
    if (getTransactionId(transaction) !== transaction.id) {
        console.log('invalid coinbase tx id: ' + transaction.id)
        return false
    }

    if (transaction.txIns.length !== 1) {
        console.log('one txIn must be specified in the coinbase transaction')
        return false
    }

    if (transaction.txIns[0].txOutIndex !== blockIndex) {
        console.log('the txIn signature in coinbase tx must be the block height')
        return false
    }

    if (transaction.txOuts.length !== 1) {
        console.log('invalid number of txOuts in coinbase transaction')
    }

    if (transaction.txOuts[0].amount !== COINBASE_AMOUNT) {
        console.log('invalid coinbase amount in coinbase transaction')
        return false
    }
    return true
}

const validateBlockTransactions = (aTransactions: Transaction[], aUnspentTxOuts: UnspentTxOut[], blockIndex: number): boolean => {
    const coinbaseTx = aTransactions[0]
    if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
        console.log('invalid coinbase transaction: ' + JSON.stringify(coinbaseTx))
    }

    const txIns: TxIn[] = _(aTransactions)
        .map(tx => tx.txIns)
        .flatten()
        .value()

    if (hasDuplicates(txIns)) {
        return false
    }

    const normalTransactions: Transaction[] = aTransactions.slice(1)
    return normalTransactions.map((tx) => validateTransaction(tx, aUnspentTxOuts))
        .reduce((a, b) => (a && b), true)
}

const validateTxIn = (txIn: TxIn, transaction: Transaction, aUnspentTxOuts: UnspentTxOut[]): boolean => {
    const referencedUnspentTxOut: UnspentTxOut =
        aUnspentTxOuts.find((uTxO) => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex)
    
    if (referencedUnspentTxOut == null) {
        console.log('referenced txOut not found: ' + JSON.stringify(txIn))
        return false
    }

    const address = referencedUnspentTxOut.address
    const key = ec.keyFromPublic(address, 'hex')
    console.log('before verify')

    const m = txIn.signature.match(/([a-f\d]{64})/gi)  // weird
    const signature = {
        r: m[0],
        s: m[1]
    }
    const validSignature: boolean = key.verify(transaction.id, signature)
    console.log('verified successfully')
    if (!validSignature) {
        console.log('invalid txIn signature: %s txId: %s address: %s', txIn.signature, transaction.id, referencedUnspentTxOut.address)
        return false
    }
    return true
}

const isValidTransactionsStructure = (transactions: Transaction[]): boolean => {
    return transactions
        .map(isValidTransactionStructure)
        .reduce((a, b) => (a && b), true)
};

const isValidTransactionStructure = (transaction: Transaction) => {
    if (typeof transaction.id !== 'string') {
        console.log('transactionId missing')
        return false
    }
    if (!(transaction.txIns instanceof Array)) {
        console.log('invalid txIns type in transaction')
        return false
    }
    if (!transaction.txIns
            .map(isValidTxInStructure)
            .reduce((a, b) => (a && b), true)) {
        return false
    }

    if (!(transaction.txOuts instanceof Array)) {
        console.log('invalid txIns type in transaction')
        return false
    }

    if (!transaction.txOuts
            .map(isValidTxOutStructure)
            .reduce((a, b) => (a && b), true)) {
        return false
    }
    return true
};

//valid address is a valid ecdsa public key in the 04 + X-coordinate + Y-coordinate format
const isValidAddress = (address: string): boolean => {
    if (address.length !== 130) {
        console.log('invalid public key length');
        return false;
    } else if (address.match('^[a-fA-F0-9]+$') === null) {
        console.log('public key must contain only hex characters');
        return false;
    } else if (!address.startsWith('04')) {
        console.log('public key must start with 04');
        return false;
    }
    return true;
};

const hasDuplicates = (txIns: TxIn[]): boolean => {
    const groups = _.countBy(txIns, (txIn) => txIn.txOutId + txIn.txOutId)
    return _(groups)
        .map((value, key) => {
            if (value > 1) {
                console.log('duplicate txIn: ' + key)
                return true
            } else {
                return false
            }
        })
        .includes(true)
}

export {
    processTransactions, signTxIn, getTransactionId, 
    UnspentTxOut, TxIn, TxOut, Transaction,
    getCoinbaseTransaction, getPublicKey, isValidAddress,
    validateTransaction
}