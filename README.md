This project is a chat application that connects an HTML frontend to an Ollama AI model (Gemma3) for a chatbot experience with Nginx. The backend is run by Bun/Hono saving chat histories to SQLite using Docker containers. 

Docker, Docker Compose, and mkcert (shown later) are prerequisites to use this chatbot and ensure that ports 8080, 3000, 80, and 443 are available. Make sure to download Docker and Docker Compose before continuing.

Download the files and before running the program, local HTTPS certificates must be generated for the Caddy server. Delete the existing PEM files in the certs directory, create new certs by running this command in the terminal of the project:

```
mkcert -cert-file certs/week8.test.pem -key-file certs/week8.test-key.pem week8.test
```

Force Caddy to rebuild by running:

```
docker compose up -d --force-recreate --no-deps caddy
```

Run the following compose in the terminal once the above steps are complete: 

```
docker compose -f compose.yml -f compose.ollama.yml up --build
```

Once the containers are up, open the following webpage to see the chatbot: 

http://localhost:8080/chat.html

When you type a chat in the text box and click send, the browser will send the request to the Bun app, which will ask Ollama for an AI response and return it back to the browser. There is a visual with the draw.io file provided in the repository for reference.

If you want to create a new chat thread, you can click the new chat button on the top left and it will save the previous chat, with an incrementing chat id. You can also delete chats using the delete button. You can go back to old chats that you have not deleted yet and it will resume that chat's history. Further development will be implemented to change the name of chats and the proper chat id numbers. 