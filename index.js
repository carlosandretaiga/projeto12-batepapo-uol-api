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
    const participants = await db.collection("participants").find().toArray();
    response.send(participants);
  } catch (error) {
    response.status(500).send("Infelizmente não conseguimos listar os participantes");
    return;
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

  const validShema = participantSchema.validate(participant, {abortEarly: false});

  if(validShema.error) {
    response.sendStatus(422);
    return;
  }

  const newMessageEntry = {
    from: participant.name,
    to: 'Todos',
    text: 'entra na sala...',
    type: 'status', 
    time: entryTime
  }


  try {

    const participantExists = await db.collection("participants").findOne({name: participant.name});

    if(participantExists) {
      response.sendStatus(409);
      return;
    }

    await db.collection("participants").insertOne(newParticipant);

    await db.collection("messages").insertOne(newMessageEntry);
    response.sendStatus(201);
  } catch (error) {
    response.status(500).send("Infelizmente não podemos permitir sua participação no chat", error);

  }
});


app.post("/messages", async (request, response) => {
  const message = request.body;
  const {user} = request.headers;
  console.log(user);

  const newMessageSend = {
    from: user,
    to: message.to,
    text: message.text,
    type: message.type, 
    time: entryTime
  }

  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required(), 
    time: joi.string().valid('message', 'private_message').required()
  });

  const validacao = messageSchema.validate(message, {abortEarly: false});

  if(validacao.error) {
    response.status(422).send(validacao.error.details.map(detailError => detailError.message));
    return;
  }

  try {

    const participantExists = await db.collection("participants").findOne({name: user});

    if(!participantExists) {
      response.sendStatus(422);
      return;
    }

    await db.collection("messages").insertOne(newMessageSend);
    response.sendStatus(201);
  } catch (error) {
    response.status(422).send("Usuário não consta!", error);
    return;
   
  }

});


/* setInterval( async () => {

  try {
    //verificar quem está inativo. Tentar usar map. .find, .insert, .delete, .update

    
  } catch (error) {
    
  }

}, 1500) */



app.listen(5000, () => {
  console.log(chalk.bold.green('Servidor funcionando na porta 5000!'));
});