import * as _ from 'lodash'
import { Transaction, UnspentTxOut, validateTransaction } from './transaction'
import { TxIn } from './transaction'
import { transcode } from 'buffer'

let transactionPool: Transaction[] = []

const getTransactionPool = () => {
    return _.cloneDeep(transactionPool)
}

const addToTransactionPool = (tx: Transaction, aUnspentTxOuts: UnspentTxOut[]) => {
    if (!validateTransaction(tx, aUnspentTxOuts)) {
        throw Error('Trying to add invalid tx to pool')
    }

    if (!isValidTxForPool) {
        throw Error('Trying to add invalid tx to poo')
    }


    transactionPool.push(tx)
}

const updateTransactionPool = (unspentTxOuts: UnspentTxOut[]) => {
    const invalidTxs = []
    for (const tx of transactionPool) {
        for (const txIn of tx.txIns) {
            if (!hasTxIn(txIn, unspentTxOuts))
            invalidTxs.push(tx)
            break
        }
    }

    if (invalidTxs.length > 0) {
        console.log('removing the following transactions from txPool: %s', JSON.stringify(invalidTxs))
        transactionPool = _.without(transactionPool, ...invalidTxs)
    }
}

const hasTxIn = (txIn: TxIn, aUnspentTxOuts: UnspentTxOut[]) => {
    const foundTxIn = aUnspentTxOuts.find((uTxO: UnspentTxOut) => {
        return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex
    })
    return foundTxIn !== undefined
}

const getTxPoolIns = (aTransactionPool: Transaction[]): TxIn[] => {
    return _(aTransactionPool)
        .map((tx: Transaction) => tx.txIns)
        .flatten()
        .value()
}
 
const isValidTxForPool = (tx: Transaction, aTransactionsPool: Transaction[]): boolean => {
    const txPoolIns: TxIn[] = getTxPoolIns(aTransactionsPool)

    const containsTxIn = (txIns: TxIn[], txIn: TxIn) => {
        return _.find(txPoolIns, ((txPoolIn: TxIn) => {
            return txIn.txOutIndex === txPoolIn.txOutIndex && txIn.txOutId === txPoolIn.txOutId
        }))
    }

    for (const txIn of tx.txIns) {
        if (containsTxIn(txPoolIns, txIn)) {
            console.log('txIn already found in the txPool')
            return false
        }
    }
    return true
}

export { getTransactionPool, addToTransactionPool, updateTransactionPool }