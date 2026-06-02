const express = require('express');
const path = require('path');
const app = express();
app.use(express.static('public'));
app.listen(7778, () => console.log('管理面板: http://localhost:7778'));
