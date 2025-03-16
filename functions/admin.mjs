import { AdatreeBanking, Timeline } from './adatree-banking.js';

const token = process.env.TOKEN;
const databaseConnection = process.env.MONGODB_CONNECTION;

// const api = new AdatreeBanking(token, databaseConnection);
// await api.setConsent();
// api.setBatchId();
// const accounts = await api.loadAccounts();
// await api.loadBalances(accounts);
// await api.loadTransactions(accounts);

const accountId = "Yh-vTclZPkKjcYfnu0LHxb29tODb5o4B071Dd5nN_YA";
const timeline = new Timeline(new Date('2025-01-01'), new Date('2025-03-03'), accountId, databaseConnection)
console.log(await timeline.build())
console.log('done');
