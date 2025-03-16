import React, { createContext, useContext, useMemo } from 'react';
import {
  ChakraProvider,
  Flex,
  Heading,
  Select,
} from '@chakra-ui/react';

import {
  Switch,
  Route,
  getRouter,
  useNavigo,
} from "navigo-react";

import { useAPISWR } from './api';
import Graph from './graph';


const navTo = (accountId, start, end) => getRouter().navigate(`account/${accountId}/${start}/${end}`);

function Account() {
  const { accountId, start, end } = useContext(graphContext)
  const startDate = new Date(Number(start));
  const endDate = new Date(Number(end));
  const { data } = useAPISWR(
    `/accounts/${accountId}/timeline/${startDate.toJSON()}/${endDate.toJSON()}`,
    { keepPreviousData: true }
  );
  console.log({data})
  const x = useMemo(_ => console.log('regen'))
  const transactions = data?.transactions;

  const handleDateChange = (newStart, newEnd) => navTo(accountId, newStart, newEnd)

  return <Flex direction="column">
    { transactions && <Graph onDateChange={handleDateChange} transactions={transactions} startDate={startDate} endDate={endDate} /> }
    <Flex direction="column">
      { transactions && transactions.map(txn => (
        <Flex key={txn.transactionId}>
          { txn.transactionId } :  { txn.executionDateTime } : { txn.amount } : { txn.balance } : { txn.description }
        </Flex>
      )) }
    </Flex>
  </Flex>
}

const graphContext = createContext({});

function GraphContext({children}) {
  const { match } = useNavigo();
  const { data } = match;

  return <graphContext.Provider value={data}>
    {children}
  </graphContext.Provider>
}

function AccountChooser({accounts}) {
  const { accountId, start, end } = useContext(graphContext);

  function toAccount(e) {
    navTo(e.target.value, start, end)
  }

  return <Select value={accountId} onChange={toAccount}>
  { accounts && accounts.map(({accountId, displayName}) => (
    <option key={accountId} value={accountId}>{displayName}</option>
  )) }
</Select>

}

export default function App() {
  const { data: accounts } = useAPISWR("/accounts");

  if(!(accounts)) return 'loading';

  const start = Number(new Date('2025-02-01'));
  const end = Number(new Date('2025-04-01'));

  return <ChakraProvider>
    <Switch>
      <Route path="/">
        { accounts.map(({accountId, displayName}) => (
          <Heading onClick={() => navTo(accountId, start, end)} key={accountId}>{displayName}</Heading>
        )) }
      </Route>
      <Route path="/account/:accountId/:start/:end">
        <GraphContext>
          <Flex direction="column">
            <AccountChooser accounts={accounts}/>
            <Account/>
          </Flex>
        </GraphContext>
      </Route>
    </Switch>
  </ChakraProvider>;
}
