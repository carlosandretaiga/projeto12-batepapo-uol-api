import express from 'express';
import chalk from 'chalk';
import cors from 'cors';
import {MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';

import dayjs from 'dayjs';

const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();
const database = process.env.BANCO_APP; 

let db = null;
let now = dayjs();
let entryTime = now.format("HH:mm:ss")



const mongoClient = new MongoClient(process.env.MONGO_URL);
const promise =  mongoClient.connect();
promise.then(() => {
  db = mongoClient.db(database);
  console.log(chalk.blue.bold("Conexão com o banco de dados está funcionando!"))
});
promise.catch(error => {
  console.log("Não conectou ao banco", error);
});


app.get("/participants", async (request, response) => {
  try {
    const participants = await db.collection("participants").find({}).toArray();
    response.send(participants);
  } catch (error) {
    console.log(chalk.bold.red("Erro ao receber a listagem de participantes"), error);
    response.status(500).send("Infelizmente não conseguimos listar os participantes");
  }
});


app.post("/participants", async (request, response) => {
  const participant = request.body;

  console.log("Body da nossa requisição", participant.name);

  const newParticipant = {
    name: participant.name,
    lastStatus: Date.now()
  };

  const participantSchema = joi.object({
    name: joi.string().required()
  });

  const validacao = participantSchema.validate(participant, {abortEarly: false});
  console.log(validacao);

  if(validacao.error) {
    response.status(422).send(validacao.error.details.map(detail => detail.message));
    return;
  }

  const participantBanco = await db.collection("participants").find({}).toArray();


  
  const newMessageEntry = {
    from: participant.name,
    to: 'Todos',
    text: 'entra na sala...',
    type: 'status', 
    time: entryTime
  }


  try {

    //console.log(participantBanco);

    if(participantBanco.find((newUser) => newUser.name === participant.name)) {
      response.sendStatus(409);
      //console.log("O participante já existe!");
      return;
    }

    await db.collection("participants").insertOne(newParticipant);

    await db.collection("messages").insertOne(newMessageEntry);
    response.sendStatus(201);
  } catch (error) {
    response.status(500).send("Infelizmente não podemos permitir sua participação no chat", error);

  }
});



app.listen(5000, () => {
  console.log(chalk.bold.green('Servidor funcionando na porta 5000!'));
});