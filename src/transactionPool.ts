import * as _ from 'lodash'
import { Transaction, UnspentTxOut, validateTransaction } from './transaction'
import { TxIn } from './transaction'

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

export { getTransactionPool, addToTransactionPool }