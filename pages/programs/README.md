# Ascendency Modelling

## Commands

```txt
CONFIG {
  WIDTH 5
  HEIGHT 5

  TRANSFER_RATE 0.5
  LEARNING_LEAK 0.1

  PREDICTION_DELAY 5
  PREDICTION_WINDOW 1

  ACTIVATION sigmoid
}

transferRate, is % of weight transferred to forward flows when value=1
learningLeak, adds intentional ineffciency to learning. influences exploration vs exploitation

predictionDelay, is # of ticks between sending an input & reading the output
predictionWindow, is # of ticks an input signal is maintained for & spent monitoring output

sigmoid is the only activation available; our sigmoid is zero-centered. max=1 is important. vanishing gradients aren't problematic because we don't use gradients
```

```txt
SEED `Date.now()`

reset random number generator
```

```txt
NODE label location [flag]
NODE A 0,0 INPUT

single point
```

```txt
FLOW a b w
FLOW A B `random(-1, 1)`

connection between two nodes
```

```txt
VECTOR label topLeft bottomRight [flag]
VECTOR A 3,0 3,3

labelled collection of nodes
```

```txt
LINEAR a b weight
LINEAR A B `random(0, 1)`

links vectors: from each node in "a" to each node in "b"
```

```txt
GRID topLeft bottomRight weight
GRID 0,0 3,3 `random(-1, 1)`

grid shape
```
