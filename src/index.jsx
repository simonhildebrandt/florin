import "@babel/polyfill";

import React from 'react';
import ReactDOM from 'react-dom/client';

const App = () => "Rendered!";

ReactDOM.createRoot(document.getElementById('app')).render(<App/>);
