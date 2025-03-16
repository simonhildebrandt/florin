import { MongoClient } from "mongodb";

class MongoService {
  constructor(databaseConnection) {
    this.databaseConnection = databaseConnection;
  }

  getClientAndDatabase() {
    const client = new MongoClient(this.databaseConnection);
    const database = client.db('florin');
    return {client, database};
  }
}

export class Timeline extends MongoService {
  constructor(start, end, accountId, databaseConnection) {
    super(databaseConnection)
    this.accountId = accountId;
    this.start = start;
    this.end = end;
  }

  async build() {
    const { client, database } = this.getClientAndDatabase();
    const $balances = database.collection('balances');
    const $transactions = database.collection('transactions');

    let options = { sort: { batchId: 1 } };
    let query = {
      accountId: this.accountId,
      batchId: { $gt: this.start, $lt: this.end }
    };
    let cursor = await $balances.find(query, options);
    const balances = await cursor.toArray();
    options = { limit: 1, sort: { batchId: 1 } };
    query = {
      accountId: this.accountId,
      batchId: { $gt: this.end }
    };
    const trailingBalance = await $balances.findOne(query, options);

    if (trailingBalance) {
      balances.push(trailingBalance)
    }

    const promises = balances.map(async balance => {
      const { batchId, currentBalance } = balance;
      let total = Number(currentBalance);
      const cursor = await $transactions.find(
        { accountId: this.accountId, batchId },
        { sort: { executionDateTime: 1 } }
      )
      const transactions = await cursor.toArray();
      transactions.forEach(transaction => {
        const { amount } = transaction;
        const transTotal = Number(amount);
        transaction.balance = total;
        total = total - transTotal;
        console.log({total, transTotal})
      })
      return await transactions;
    })
    const transactions = await Promise.all(promises);

    await client.close();
    return transactions.flat();
  }
}

export class AdatreeBanking extends MongoService {
  constructor(token, databaseConnection) {
    super(databaseConnection)
    this.token = token;
    this.batchId = new Date();
  }

  get headerOptions() {
    return {
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: 'application/json'
      }
    }
  }

  get host() {
    return 'https://cdr-insights-prod.api.adatree.com.au';
  }

  get activeConsentsUrl() {
    return `${this.host}/consents/v2?status=ACTIVE`
  }

  get adrUrl() {
    return `${this.host}/adr`
  }

  get bankingUrl() {
    return `${this.adrUrl}/banking`
  }

  get arrangementsUrl() {
    return `${this.bankingUrl}/arrangements/${this.arrangementId}`;
  }

  get accountsUrl() {
    return this.arrangementsUrl + '/accounts';
  }

  setBatchId() {
    this.batchId = new Date();
  }

  async setConsent() {
    const request = new Request(
      this.activeConsentsUrl,
      this.headerOptions
    );

    const response = await fetch(request)
    const { consents } = await response.json();
    if (consents.length < 1) {
      throw "No consents found"
    }
    this.arrangementId = consents[0].cdrArrangementId;
  }

  async loadAccounts() {
    console.log(`loading accounts`)

    const request = new Request(
      this.accountsUrl,
      this.headerOptions
    );

    const response = await fetch(request)
    const { data: { accounts } } = await response.json();

    const { client, database } = this.getClientAndDatabase();
    const $accounts = database.collection('accounts');

    const promises = accounts.map(async account => {
      await $accounts.updateOne(
        { accountId: { $eq: account.accountId }},
        { $set: account },
        { upsert: true }
      )
    });
    await Promise.all(promises);
    await client.close();

    return accounts;
  }

  async loadTransactions(accounts) {
    const { client, database } = this.getClientAndDatabase();
    const $transactions = database.collection('transactions');

    const promises = accounts.map(async account => {
      const request = new Request(
        `${this.accountsUrl}/${account.accountId}/transactions?page-size=1000`,
        this.headerOptions
      );

      const response = await fetch(request);
      const { data } = await response.json();
      const { transactions } = data;
      console.log(`${transactions.length} transactions for ${account.displayName}`)
      if (transactions.length > 0) {
        const transPromises = transactions.map(async transaction => {
          await $transactions.updateOne(
            { transactionId: { $eq: transaction.transactionId }},
            { $set: {...transaction, batchId: this.batchId } },
            { upsert: true }
          );
        })
        await Promise.all(transPromises);
      } else {
        console.log(`No transactions for ${account.accountId} - ${account.displayName}`)
      }
      console.log(`done with ${account.displayName}`);
    });

    await Promise.all(promises);
    await client.close();
  }

  async loadBalances(accounts) {
    const { client, database } = this.getClientAndDatabase();
    const $balances = database.collection('balances');

    const accountIds = accounts.map(a => a.accountId);
    const request = new Request(
      `${this.accountsUrl}/balances?accountIds=${accountIds}`,
      this.headerOptions
    );

    const response = await fetch(request);
    const { data: { balances } } = await response.json();
    const promises = balances.map(async balance => {
      // Add batch matching balance to transaction
      await $balances.updateOne(
        { accountId: { $eq: balance.accountId }, batchId: this.batchId },
        { $set: {...balance, batchId: this.batchId } },
        { upsert: true }
      )
    });
    await Promise.all(promises);
    await client.close();
  }
}


