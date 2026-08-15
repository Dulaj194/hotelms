$serverIP = "18.138.34.134"
$user = "ubuntu"
$key = "hotelMS.pem"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "      HotelMS EC2 Deployment Script       " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Packaging project files..." -ForegroundColor Yellow
# Using git archive to respect .gitignore and package only committed files
git archive -o deploy.zip HEAD

Write-Host "2. Ensuring remote directory exists..." -ForegroundColor Yellow
ssh -i $key -o StrictHostKeyChecking=no ${user}@${serverIP} "mkdir -p ~/hotelms/backend ~/hotelms/frontend"

Write-Host "3. Uploading project files and .env configurations..." -ForegroundColor Yellow
scp -i $key -o StrictHostKeyChecking=no deploy.zip ${user}@${serverIP}:~/hotelms/

if (Test-Path ".env") { 
    scp -i $key -o StrictHostKeyChecking=no .env ${user}@${serverIP}:~/hotelms/ 
}
if (Test-Path "backend/.env") { 
    scp -i $key -o StrictHostKeyChecking=no backend/.env ${user}@${serverIP}:~/hotelms/backend/ 
}
if (Test-Path "frontend/.env") { 
    scp -i $key -o StrictHostKeyChecking=no frontend/.env ${user}@${serverIP}:~/hotelms/frontend/ 
}

Write-Host "4. Deploying on EC2 server with Docker Compose..." -ForegroundColor Yellow
ssh -i $key -o StrictHostKeyChecking=no ${user}@${serverIP} "
    cd ~/hotelms
    unzip -o deploy.zip
    rm deploy.zip
    docker compose -f docker-compose.prod.yml up --build -d
"

Write-Host "5. Cleaning up local temporary files..." -ForegroundColor Yellow
Remove-Item deploy.zip

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "   Deployment completed successfully!     " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Your application is now running on http://$serverIP" -ForegroundColor Green
