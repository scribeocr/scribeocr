import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url));

// Set up the Express app
const app = express();
const port = 3031;

// Serve static files from the project directory
app.use(express.static(path.resolve(__dirname, '..')));

// Start the server
const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

app.get('/shutdown', (req, res) => {
    res.send('Shutting down the server...');
    process.exit(0); // This will shut down the server
});
