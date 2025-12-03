# Rock-Paper-Scissors Game

This project is a simple static website for a Rock-Paper-Scissors game. It allows users to play the game against the computer and displays the results of each round.

## Project Structure

```
rock-paper-scissors-static-site
├── index.html          # Main HTML file for the game
├── 404.html            # Custom 404 error page
├── assets
│   ├── css
│   │   └── styles.css  # CSS styles for the website
│   ├── js
│   │   └── app.js      # JavaScript code for game logic
│   └── images          # Directory for game-related images
├── s3
│   ├── bucket-policy.json  # S3 bucket policy for public access
│   └── deploy.sh           # Deployment script for S3
└── README.md            # Project documentation
```

## Getting Started

To set up the project locally, follow these steps:

1. Clone the repository or download the project files.
2. Open `index.html` in your web browser to play the game.

## Deployment

To deploy the website to an S3 bucket, follow these steps:

1. Configure your S3 bucket with the appropriate settings for static website hosting.
2. Update the `bucket-policy.json` file with your desired permissions.
3. Run the `deploy.sh` script to sync the local files with your S3 bucket.

## Game Instructions

1. Click on one of the buttons (Rock, Paper, or Scissors) to make your choice.
2. The computer will randomly select its choice.
3. The result will be displayed on the screen, indicating whether you won, lost, or tied.

Enjoy playing Rock-Paper-Scissors!