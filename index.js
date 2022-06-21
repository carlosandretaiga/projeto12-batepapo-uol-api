import express from 'express';
import chalk from 'chalk';
import cors from 'cors';

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (request, response) => {
  response.send("Hello!");
});

app.listen(5000, () => {
  console.log(chalk.bold.green('Servidor funcionando na porta 5000!'));
});