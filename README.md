# Telegram bot

Простой Telegram-бот на Python (python-telegram-bot).

## Запуск

1. Создайте бота у [@BotFather](https://t.me/BotFather) командой `/newbot` и скопируйте токен.
2. Установите зависимости:
   ```
   pip install -r requirements.txt
   ```
3. Запустите бота:
   ```
   BOT_TOKEN=ваш_токен python bot.py
   ```
   (Windows PowerShell: `$env:BOT_TOKEN="ваш_токен"; python bot.py`)

Не публикуйте токен в репозитории.

## Команды

- `/start` - приветствие
- `/help` - список команд
- `/time` - текущее время
- `/echo <текст>` - повторить текст
