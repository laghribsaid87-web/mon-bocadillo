git reset --soft 667db51
git rm --cached .env functions/.env
Add-Content -Path .gitignore -Value ".env"
Add-Content -Path functions/.gitignore -Value ".env"
git add .
git commit -m "Mise a jour globale (Web, APK, EXE via Github)"
git push
