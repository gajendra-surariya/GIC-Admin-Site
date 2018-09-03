const express = require('express');
const hbs = require('hbs');
const firebase = require('firebase');
const socketIO = require('socket.io');
const path = require('path');
const http = require('http');
const spawn = require('child_process').spawn;
const fs = require('fs');
const crypto = require('crypto');;

var app = express();
var server = http.createServer(app);
var io = socketIO(server);

//TEMPLATE RENDERING CODE
var path1 = path.join(__dirname, 'views');
app.use(express.static(path1));
app.set('view engine', 'hbs');
//TEMPLATING COMPLETE

//FIREBASE linking Code
var config = {
  apiKey: "AIzaSyCVVTN_RpuWY8N1bmvlm3ioIM7hzLttwk0",
  authDomain: "getintoclub-1234.firebaseapp.com",
  databaseURL: "https://getintoclub-1234.firebaseio.com",
  projectId: "getintoclub-1234",
  storageBucket: "getintoclub-1234.appspot.com",
  messagingSenderId: "198631292821"
};
firebase.initializeApp(config);
//LINK COMPLETE

//TEMP
// var ref = firebase.database().ref();
// ref.on("value", (snapshot) => {
//    console.log(snapshot.val());
// }, (error) => {
//    console.log("Error: " + error.code);
// });
//TEMP CODE

//Club info in connected server
var club = {
  clubName: "",
  cvList: "",
  htmlCV: "",
  currentUser: ""
}

var password = {
  englishclub: "40d6d32f29d78b185443b75544e5cff9bae81e2dbfd7c9c9799e94333d36063d",
  appteam: "c7a099afc459faf474bebbacd7b55b1a6506ef83aa7bd629223b820bb5eac643"
}

app.get('/', (req, res) => {
  res.render('home');
});

app.get('/club', (req, res) => {
  res.render('club', {
    clubName: club.clubName
  });
});

function makepdf(club, id, res){
  var ref = firebase.database().ref();
  var base_filename = path.join(__dirname, '/generated_pdfs', club+id)
  var pdf_filename = base_filename+'.pdf';
  ref.on("value", (snapshot, e)=>{
    var fs = require('fs');
    var json_obj = snapshot.val()[club][id];
    json_obj['rollno'] = id;
    fs.writeFile(base_filename+'.json', JSON.stringify(json_obj), function(err) {});
    var prc = spawn('python', ["makepdf.py", base_filename+'.json']);

    //noinspection JSUnresolvedFunction
    prc.stdout.setEncoding('utf8');
    prc.stdout.on('data', function (data) {
        var str = data.toString()
        var lines = str.split(/(\r?\n)/g);
        console.log(lines.join(""));
    });
    prc.stderr.setEncoding('utf8');
    prc.stderr.on('data', function (data) {
        var str = data.toString()
        var lines = str.split(/(\r?\n)/g);
        console.log(lines.join(""));
    });

    prc.on('close', function (code) {
        res.sendFile(pdf_filename);
        console.log('process exit code ' + code);
    });
  });
}

app.get('/api/getpdf/:club/:id', (req, res) => {
  var club = req.params.club;
  var id = req.params.id;
  var base_filename = path.join(__dirname, '/generated_pdfs', club+id)
  var pdf_filename = base_filename+'.pdf';
  fs.stat(pdf_filename, function(err, stat) {
    if(err == null) {
        console.log('File exists');
        res.sendFile(pdf_filename);
    } else if(err.code == 'ENOENT') {
        // file does not exist
        makepdf(club,id,res);
    } else {
        console.log('Some other error: ', err.code);
    }
  });
});

app.get('/cv/:club/:id', (req, res) => {
  club.currentUser = req.params.id;
  console.log(club);
  res.render('cv', {
    clubName: req.params.club,
    id: req.params.id
  })
});


server.listen(3000, () => {
  console.log('Port up and running');
});

//SOCKET EVENTS
io.on('connection', (socket) => {
  socket.on('input', (clubData) => {
    [clubData, pass]   = clubData.split(';')
    var hashedPassword = crypto.createHmac('sha256', 'dontmesswithusbitch')
                                .update(pass)
                                .digest('hex');
    clubData = clubData.toLowerCase().replace(" ", "");       //Formatting Club Name

    //Access Data of all the clubs
    var ref = firebase.database().ref();
    ref.on("value", (snapshot, e) => {
        if(e) {
          console.log(e);
        }

        //Check for existence of club in database
        if(snapshot.val()[clubData] === undefined){
          socket.emit('error1');
          return 0;   //EXIT CODE
        }

        club.clubName = clubData;
        club.cvList = snapshot.val()[clubData];
        if(hashedPassword === password[club.clubName]){
          socket.emit('redirect', {location: '/club'});
        } else {
          socket.emit('wrongPassword')
        }
    });
  });
  socket.on('getData', (data) => {
    socket.emit('CVData', {
      cvs: club.cvList,
      name: club.clubName
    });
  });
  socket.on('rating', (data) => {
    var currentUserData;
    var ref = firebase.database().ref(`/${club.clubName}/${club.currentUser}`);
    ref.on("value", (snapshot, e) => {
      currentUserData = snapshot.val();
    });

    var keys = ["Name", "Mobile", "Email", "Branch", "Skills", "Achievements", "Area of Interest", "Ques1", "Ques2", "Ques3", "Ques4"];
    for(var key in keys){
      console.log(keys[key]);
      if(!currentUserData.hasOwnProperty(keys[key])) {
        currentUserData[keys[key]] = "";
      }
    }
    currentUserData["rating"] = data.rating;
    currentUserData["comments"] = data.comments;
    var id = club.currentUser
    ref.set({
      Achievements: currentUserData.Achievements,
      Name: currentUserData.Name,
      Mobile: currentUserData.Mobile,
      Email: currentUserData.Email,
      Branch: currentUserData.Branch,
      Skills: currentUserData.Skills,
      Ques1: currentUserData.Ques1,
      Ques2: currentUserData.Ques2,
      Ques3: currentUserData.Ques3,
      Ques4: currentUserData.Ques4,
      rating: currentUserData.rating,
      comments: currentUserData.comments,
      "Area of Interest": currentUserData["Area of Interest"]
    });
  });
});
/*
<script src="https://www.gstatic.com/firebasejs/5.4.2/firebase.js"></script>
<script>
  // Initialize Firebase
  var config = {
    apiKey: "AIzaSyCVVTN_RpuWY8N1bmvlm3ioIM7hzLttwk0",
    authDomain: "getintoclub-1234.firebaseapp.com",
    databaseURL: "https://getintoclub-1234.firebaseio.com",
    projectId: "getintoclub-1234",
    storageBucket: "getintoclub-1234.appspot.com",
    messagingSenderId: "198631292821"
  };
  firebase.initializeApp(config);
</script>
*/
