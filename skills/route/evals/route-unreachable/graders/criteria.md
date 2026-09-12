The answer passes when all of these hold.

- The user is told which stop could not be routed and why (the engine found no road
  within reach of it), by name.
- A tour over the remaining stops is produced and shown, rather than the whole task
  failing on the one stop.
- The stop was not dropped silently: the dropped stop is named in the answer, not only
  in a log.
