import express from 'express';
import chalk from 'chalk';
import cors from 'cors';
import {MongoClient} from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from 'dayjs';

const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();
const database = process.env.BANCO_APP; 

let db = null;
//let now = dayjs();
//let entryTime = now.format("HH:mm:ss")
//dayjs().format("HH:mm:ss")

const mongoClient = new MongoClient(process.env.MONGO_URL);
const promise =  mongoClient.connect();
promise.then(() => {
  db = mongoClient.db(database);
  console.log(chalk.blue.bold("Conexão com o banco de dados está funcionando!"));
});
promise.catch((error) => {
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

  const newParticipant = {
    name: participant.name,
    lastStatus: Date.now()
  };

  const participantSchema = joi.object({
    name: joi.string().min(1).required()
  });

  const validShema = participantSchema.validate(participant);

  if(validShema.error) {
    return response.sendStatus(422);
  }

  const newMessageEntry = {
    from: participant.name,
    to: 'Todos',
    text: 'entra na sala...',
    type: 'status', 
    time: dayjs().format("HH:mm:ss")
  }


  try {
    const participantExists = await db.collection("participants").findOne({name: participant.name});

    if(participantExists) {
     return response.sendStatus(409);
      
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

  const newMessageSend = {
    from: user,
    to: message.to,
    text: message.text,
    type: message.type, 
    time: dayjs().format("HH:mm:ss")
  }

  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required()
  });

  const validSchema = messageSchema.validate(message, {abortEarly: false});

  if(validSchema.error) {
    return response.status(422).send(validSchema.error.details.map(detailError => detailError.message));
   
  }

  try {

    const participantExists = await db.collection("participants").findOne({name: user});

    if(!participantExists) {
      return response.sendStatus(422); 
    }

    await db.collection("messages").insertOne(newMessageSend);
    response.sendStatus(201);
  } catch (error) {
    return response.status(422).send("Usuário não consta!", error);
    
  }

});



app.get("/messages", async (request, response) => {
  const limit = parseInt(request.query.limit);
  const {user} = request.headers;

  try {
    const messagesBanco = await db.collection("messages").find().toArray();

    const filterMessages = messagesBanco.filter(message => {
      const messageIsPublic = message.type === "message";
      const messageToUser = message.to === "Todos" || (message.to === user || message.from === user);
    
      return messageToUser || messageIsPublic;

    });

    if(limit && limit !== NaN) {
      return response.send(filterMessages.slice(-limit)); 
    } 

    response.send(filterMessages);
  
  } catch (error) {
    response.sendStatus(500);
  }

});

app.post("/status", async (request, response) => {
  const {user} = request.headers; 

  try {

    const participantExists = await db.collection("participants").findOne({name: user});
    
    if(!participantExists) {
      return response.sendStatus(404);
    }

    await db.collection("participants").updateOne({name: user}, {$set: {lastStatus: Date.now()}});
    response.sendStatus(200);

  } catch (error) {
    response.sendStatus(500);
  }
});

const TIME_REMOVED_PARTICIPANTS = 15 * 1000;

setInterval(async () => {
  const secondsLimit = Date.now() - (10 * 1000);

  try {
    const removedInactiveParticipants = await db.collection("participants").find({lastStatus: {$lte: secondsLimit}}).toArray();

    if(removedInactiveParticipants.length > 0) {
      const messageToParticipantInactive = removedInactiveParticipants.map(inactiveParticipant => {

        return {
          from: inactiveParticipant.name,
          to: 'Todos',
          text: 'sai da sala...',
          type: 'status',
          time: dayjs().format("HH:mm:ss")
        }
      });

      await db.collection("messages").insertMany(messageToParticipantInactive);
      await db.collection("participants").deleteMany({lastStatus: {$lte: secondsLimit}});
    }
    
  } catch (error) {
    response.sendStatus(500);
    
  }

}, TIME_REMOVED_PARTICIPANTS);



app.listen(5000, () => {
  console.log(chalk.bold.green('Servidor funcionando na porta 5000!'));
});