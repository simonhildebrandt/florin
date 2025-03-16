/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import functions from 'firebase-functions';

import express from 'express';
import cors from 'cors';
import { MongoClient } from "mongodb";

import { AdatreeBanking, Timeline } from './adatree-banking.js';

// const authorise = require('./authorise');

const app = express();
app.use(cors({ origin: true }));


function getClientAndDatabase() {
  const uri = process.env.MONGODB_CONNECTION;
  const client = new MongoClient(uri);
  const database = client.db('florin');
  return { client, database };
}


async function ensureUser(lwlId, details = null) {
  const { client, database } = getClientAndDatabase();
  const users = database.collection('users');

  try {
    const query = { lwlId };

    const result = await users.findOne(query);
    if (result) {
      return result;
    } else if(details) {
      const { email, name = `user${lwlId}` } = details;
      const doc = {
        lwlId,
        email,
        name,
        tags: []
      };

      await users.insertOne(doc);

      return doc;
    } else {
      return { email: 'unknown', name: `user${lwlId}`, tags: [] };
    }
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}


async function withCollections(collections, callable) {
  const { client, database } = getClientAndDatabase();
  const $accounts = database.collection('accounts');

  const collectionHandles = Object.fromEntries(collections.map(collection => {
    return [`$${collection}`, database.collection(collection)];
  }))

  try {
    return await callable(collectionHandles);
  } catch(error) {
    console.error("Error in withCollections", error.mnessage);
    throw(error);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

app.get("/accounts", async (req, res) => {
  await withCollections(['accounts'], async ({$accounts}) => {
    const cursor = $accounts.find();
    const accounts = await cursor.toArray();
    res.status(200).json(accounts);
  }).catch(error => res.status(500).json({message: error.message}))
})

// app.get("/accounts", async (req, res) => {
//     try {
//     // const user = await ensureUser(req.auth.sub, req.auth);
//     const { client, database } = getClientAndDatabase();
//     const $accounts = database.collection('accounts');

//     const cursor = $accounts.find();
//     const accounts = await cursor.toArray();

//     return res.status(200).json(accounts);
//   } catch(error) {
//     console.error(error);
//     res.status(500).json({message: error.message});
//   } finally {
//     // Ensures that the client will close when you finish/error
//     await client.close();
//   }
// });

app.get("/accounts/:accountId/transactions", async (req, res) => {
  try {
    // const user = await ensureUser(req.auth.sub, req.auth);
    const { client, database } = getClientAndDatabase();
    const $transactions = database.collection('transactions');

    const cursor = $transactions.find();
    const transactions = await cursor.toArray();

    return res.status(200).json(transactions);
  } catch(error) {
    console.error(error);
    res.status(500).json({message: error.message});
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
});

app.get("/accounts/:accountId/timeline/:start/:end", async (req, res) => {
    /*
      Get all balances in range, plus next one after;
      for each balance, get transactions by batch id;
      iterate back through balances, aggregating batch transactions
    */

  const { accountId, start, end } = req.params;
  const startDate = new Date(start);
  const endDate = new Date(end);

  console.log({accountId, startDate, endDate})

  await withCollections(['transactions', 'balances'], async ({$transactions, $balances}) => {
    const timeline = new Timeline(startDate, endDate, accountId, process.env.MONGODB_CONNECTION);
    const transactions = await timeline.build();
    console.log({transactions})
    res.status(200).json({transactions});
  }).catch(error => res.status(500).json({message: error.message}))
});

app.post('/update', async (req, res) => {
  const { token } = req.body;

  const api = new AdatreeBanking(token, process.env.MONGODB_CONNECTION);
  await api.setConsent();
  api.setBatchId();
  const accounts = await api.loadAccounts();
  await api.loadBalances(accounts);
  await api.loadTransactions(accounts);

  res.status(200).json({message: 'loaded'})
});


export const api = functions.https.onRequest(app)
