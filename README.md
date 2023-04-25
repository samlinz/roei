# röi

Objectively best time tracking software for professional* consultants. Kurkkumopo edition.

## Installation

In project folder root run `npm link`

## Commands

`list`
`log category [time] [description]`
`start [time] description`
`stop`

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
alias t="npx timer"
alias to="npx timer open"
alias tr="npx timer reaktor"
alias tl="npx timer list"
alias toihin="npx timer reaktor Töiden aloittaminen"
alias toista="npx timer reaktor Töiden lopettaminen"
```
## Kurkkumopo

<img src="./kurkkumopo.jpg" width="200px">