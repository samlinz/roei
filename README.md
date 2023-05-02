# röi

Objectively the best time tracking software for professional* consultant(s).

## Installation

In project folder root run `npm link`

## Commands

`list`

`log category [time] [description]`

`start [time] description`

`stop`

`open`

`pause`

Examples

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
alias tr="npx roei reaktor"
alias tl="npx roei list"
alias toihin="npx roei reaktor Töiden aloittaminen"
alias toista="npx roei reaktor Töiden lopettaminen"
```
## Kurkkumopo

<img src="./kurkkumopo.jpg" width="200px">