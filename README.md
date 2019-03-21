# cycle propogation

cycleprop is a brand new algorithm for training deep neural networks. i've
created a working prototype, think the idea has potential, and want to work on
it for 2 years; but cannot fund the research myself

![explainer diagram]()

when activated, CD & CE transfer a fraction of their weight to AC & BC. there is
a hidden connection between the input & output through which weight flows in a
cycle. when the model provides good answers the weight transfer is amplified

![feedback example]()

the values flow forward; the weights flow backward; the value reaches the
output; the cycle is completed; and weights can flow from input to output; the
weight transfer is amplified, which strengthens good cycles relative to bad
cycles. this algorithm maximises "weight flowing through cycle / net change in
weight over time". amplifying good answers ensures task-learning is the best way
to succeed

![xor example]()

cycleprop can solve non-linear tasks like XOR. this example uses fully-connected
layers, 0-centered sigmoid activation & modified cosine similarity. the two
input/output pairs at bottom perform a role similar to bias, and their values
are ignored. this network could be migrated to PyTorch/Tensorflow without fuss

![square example]() ![fully-connected example]()

cycleprop does not use gradients. networks are garunteed to become more stable
over time (less exergy). you can use very high learning rates without
introducing instability. given uniform value in the "square" example, any
initial weight configuration will become a perfect cycle in logarithmic time. if
you remove the input/ouput from a fully-connected layer it forms internal cycles

![amorphous example]()

cycleprop can optimise crazy-looking layers. it can "flip" connections: to learn
tasks cycleprop may redirect recurrent flows, create memory cells, and
syncronise inputs across time

**pros**

volition. cycleprop continues to improve itself without rewards or additional
examples. its reward mechanism is largely internal which may help the network
consider wholly original objectives, and form the basis for emotion-inspired
mechanisms like happiness / fear

possibility. meta

nature.

**cons**

performance. the network cannot be simulated "layer-by-layer", so a network 1000
layers deep would take 1000x more iterations to train than it would with
backprop (assuming same improvement per example). feed-forward networks can get
around this limitation with a concurrent scheduling technique, and so can
recurrent networks to a lesser extent. this limitation doesn't apply to BPTT

constraints. models must respect the laws of thermodynamics, which may challenge
researchers. i personally struggled to integrate some math, eg: negative values,
values greater than 1, bias, non-linearity, etc

**completed so far**

- working JavaScript prototype. 1 iteration per second w/ 10k connections
- fully-connected & amorphous layer types
- solved all 2-bit boolean operators and iris dataset
- DSL for designing models/experiments quickly
- realtime visual output and reproducible RNG

**next to build**

- documentation. series of programs with explainer text. learners should be able
  to open / modfiy / create programs in-browser
- GPU support. considering CuPy as target for first accelerated implementation.
  API similar to PyTorch / Keras
- convolutions, weight sharing, skip connections, pooling. all that stuff
- iterate on technique / benchmarks. stuff like DAWNBench & cosine annealing
- novelty. identify unique possibilities for cycleprop and try some out

**ascendency**

cycleprop makes use of ascendency, a phenomena described by Robert Ulanowicz in
"Ecology, The Ascendent Perspective". ascendency explains how order emerges
within interconnected systems. i think this includes explaining the nature of
God, of the soul, society, and star formation

ascendency means "rising together". the three conditions for ascendency include:

1.  variation: exchanges within a system have different characteristics
2.  autocatalysis: resources within a system are exchanged in cycles
3.  scarcity: resources available for exchange are limited

**source code**

[github.com/ashtonsix/ascendency](https://github.com/ashtonsix/ascendency)
