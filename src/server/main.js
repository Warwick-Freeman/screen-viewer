const { app, BrowserWindow } = require('electron');
const path = require('path');
//const { remote } = require('./remote-control');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

// Handler for remote messages - these are to reflect mouse and keyboard events from the remote end
function remote(data) {
  console.log('remote data:', data);
}

// create the express server to serve the client to the remote desktop browser 
// and attach socket to it
const express = require('express');
const expressApp = express();
const http = require('http');
const httpServer = http.createServer(expressApp);
const { Server }  = require('socket.io');
const io = new Server(httpServer);


// default our server to port 8888
const port = process.env.NODE_PORT || 8888;

// the web page is the client application
expressApp.use(express.static(path.join(__dirname, '../client')));

// start the server listening
httpServer.listen(port, _ => console.log(`Server listening on port ${port}`));

// start the socket listening as well
io.on('connection', handleConnection);

// handler for the socket messages - this is triggered by the connection and registers
// the rtc-message reciever.  Basically we just relay the messages between the remote browser
// running the client and the server client which is within the electron window
function handleConnection(socket) {
  console.log('client connection');

  socket.on('rtc-message',  (msg) => {
    console.log('rtc-message', msg);

    // send the message to all connected clients except the sender
    socket.broadcast.emit('rtc-message', msg);
    }
  );

  socket.on('rtc-event', remote);
}

const createWindow = () => {

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      }
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
