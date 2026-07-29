@echo off
:: CÚPULA DE AUTOMAÇÃO DE DEPLOY - CHRONICLES OF AETHERIA
:: Este script automatiza o envio da correção de bypass de login para o seu GitHub!

echo =============================================================
echo   ENVIANDO CHRONICLES OF AETHERIA PARA O SEU GITHUB...
echo =============================================================
echo.

:: Configura e-mail e nome no Git
git config user.email "brenodiogo1@example.com"
git config user.name "Breno Diogo"

:: Inicializa o Git se necessário e conecta ao repositório
git init
git remote remove origin >nul 2>&1
git remote add origin https://github.com/brenodiogo1/gametrone.git

:: Adiciona os arquivos corrigidos
echo Adicionando arquivos da pasta...
git add .

:: Salva as alterações locally
echo Salvando atualizacao no historico...
git commit -m "Feature: login removido, entrada direta no mundo 3D"

:: Define ramificação principal
git branch -M main

:: Envia de forma forçada para o seu GitHub gametrone
echo.
echo Enviando para https://github.com/brenodiogo1/gametrone.git...
echo (Se o Windows pedir permissao ou login do GitHub, basta autorizar na janela flutuante)
echo.
git push -f -u origin main

echo.
echo =============================================================
echo   UPLOADS CONCLUIDOS COM SUCESSO!
echo   O Render.com iniciará a atualização do seu jogo online agora.
echo   Aguarde 1 minuto e abra https://gametrone.onrender.com !
echo =============================================================
echo.
pause
