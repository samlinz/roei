# röi

Objectively the best time tracking software for professional* consultant(s). Personal project for personal use, use with caution.

## Installation

In project folder root run `npm link`

## Commands

`list`
- List rows for current date with total hours

`log category [time] [description]`
- Log row for `category` with optional timestamp and description (default: current time)

`start [time] description`
- Start activity with description and optional timestamp (default: current time)

`stop`
- Stop activity if active

`open`
- Open raw source text file in Sublime Text

`pause`
- Start/stop pause which is subtracted from total working hours

`config`
- Open config file

### Examples

`Y log project1 9:00 started doing things`
 
`Y log project1 started doing things`
- time inferred from current time

`Y log project1`
- description also optional

`Y start lunch`
`Y stop`
- start and stop activity, here with name "lunch"

Where Y == bin name

## Shell shortcuts

Add to bachrc or zshrc etc.
```bash
alias t="npx roei"
alias to="npx roei open"
alias tr="npx roei firma"
alias tl="npx roei list"
alias toihin="npx roei firma Töiden aloittaminen"
alias toista="npx roei firma Töiden lopettaminen"
```
## Kurkkumopo

<img src="./kurkkumopo.jpg" width="200px">
