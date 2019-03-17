# Ascendency Modelling

## Commands

```txt
WORLD width height learningRate learningLeakage

configuration
```

```txt
SEED seed

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
