# ascendency programming language

inspect the .asc files & [./core/generate.js](../core/generate.js) to learn the
language

## hyperparameters

**ACTIVATE**

only "sigmoid" is available. i adjusted the sigmoid domain to [-1.54, 1.54] &
added symetrical normalisation: repeated activation pulls negative values toward
-1, and positive values toward +1, 0 does not change

**AMPLIFY & AMPLITUDE**

inverse of error; only mse is available. networks amplify weight transfer by [1,
1 + AMPLITUDE]

**TRANSFER_RATE**

the % each flow's weight they transfer to their neighbours per tick

**CYCLE_ASPECT**

the % of weight transfer dependent upon a neighbour's weight rather than their
value/slope. can cause flow direction to flip

**CYCLE_LEAK**

the % of the cycle aspect which is distributed evenly. an upper limit to
transfer effciency increases the number of cycles the network explores. you can
squeeze networks by adding l2 dropout & lowering this parameter

**VALUE_DECAY & SLOPE_DECAY**

ensures local loops ("capacitors") drain during the reset phase
