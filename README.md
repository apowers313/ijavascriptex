# IJavascriptEX
IJavascriptEX is a JavaScript kernel for Jupyter. It is an EXtended version of the
[IJavascript](http://n-riesco.github.io/ijavascript) kernel that attempts to make
it as close as possible to the IPython experience by adding `%magic` commands,
`!shell` executables, and `{variable}` substitution.

* %addmagic
* %require
* %echo
* !cmd
* {var} substitution
* $$.addMagic
* stdmagic
* output caching
* example notebook
* adding your own magic
  * name, function
    * function args
    * doc, brief, ctx
    * function context
      * exec
      * cmdMap
      * history
      * args
      * line
      * code
  * name, cmdObj
  * documentation
    * cmdObj.doc || cmdObj.fn.
    * cmdObj.brief || cmdObj.fn.brief
  * special things
    * any symbol allowed
    * special matcher

# IJavascript
IJavascript is a Javascript kernel for the [Jupyter
notebook](http://jupyter.org/). The Jupyter notebook combines the creation of
rich-text documents (including equations, graphs and videos) with the execution
of code in a number of programming languages. The execution of code is carried
out by means of a kernel that implements the [Jupyter messaging
protocol](http://jupyter-client.readthedocs.io/en/latest/messaging.html).

The IJavascript kernel executes Javascript code inside a
[Node.js](https://nodejs.org/) session. And thus, it behaves as the Node.js REPL
does, providing access to the Node.js standard library and to any installed
[npm](https://www.npmjs.com/) modules.

<div style="clear: both;" />

Here's a sample notebook that makes use of the IJavascript kernel:

![Screenshot: Notebook Hello Sample](images/screenshot-notebook-hello.png)


## Contents

- [Main Features](#features)
- [Installation](#installation)
- [Contributions](#contributions)

## Main Features

- Run Javascript code inside a `Node.js` session
- [Hello, World!](http://n-riesco.github.io/ijavascript/doc/hello.ipynb.html)
- [Asynchronous
  output](http://n-riesco.github.io/ijavascript/doc/async.ipynb.html)
- [Custom output](http://n-riesco.github.io/ijavascript/doc/custom.ipynb.html)
  for `HTML`, `SVG`, `PNG`, ...
- [Autocompletion](http://n-riesco.github.io/ijavascript/doc/complete.md.html):
  press `TAB` to complete keywords and object properties
- [Object
  inspection](http://n-riesco.github.io/ijavascript/doc/inspect.md.html): press
  `Shift-TAB` to inspect an object and show its content or, if available, its
  documentation


## Installation

IJavascript is distributed as an [npm](https://www.npmjs.com/) package and thus
it requires:

- [Node.js](http://nodejs.org/)
- [npm](https://www.npmjs.com/)

Depending on your use, other [Jupyter tools](http://jupyter.org/) will be
necessary (e.g. Jupyter notebook). Note that IJavascript has been kept
backwards-compatibility with IPython v1, so that it's possible to use the
IPython notebook distributed in Ubuntu 14.04 LTS and Ubuntu 16.04 LTS.

For other platforms  not listed below, or if you find any problems with the instructions above,
please, refer to the [installation
notes](http://n-riesco.github.io/ijavascript/doc/install.md.html).

### Ubuntu

To install IJavascript in Ubuntu 18.04 for your user only, run:

```
sudo apt-get install nodejs npm jupyter-notebook
npm config set prefix $HOME
npm install -g ijavascript
ijsexinstall
```

Note: if `~/bin` folder didn't exist before, after running this instructions, you may need to log out and back in for `~/bin` to be added to your `PATH`.

To install IJavascript in Ubuntu 18.04 for all users, run instead:

```
sudo apt-get install nodejs npm jupyter-notebook
sudo npm install -g --unsafe-perm ijavascript
sudo ijsexinstall --install=global
```

Also, note that older versions of Ubuntu (e.g. Ubuntu 16.04 LTS) depend on `nodejs-legacy` and `ipython-notebook` instead:

```sh
sudo apt-get install nodejs-legacy npm ipython ipython-notebook
```

### Windows (Official Python Distribution)

In the command line:

```sh
pip3 install --upgrade pip
pip3 install jupyter
npm install -g ijavascript
ijsexinstall
# Or run: %appdata%\npm\ijsexinstall
```

Then you can run `jupyter notebook` in your terminal to load Jupyter Notebook. 
When you create a new Jupyter Notebook, you should see the Javascript (Node) 
kernel available.


### Windows (Anaconda Distribution)

Open the *Anaconda prompt* and run:

```sh
conda install nodejs
npm install -g ijavascript
ijsexinstall
```

Then you can run `jupyter notebook` in your terminal to load Jupyter Notebook. 
When you create a new Jupyter Notebook, you should see the Javascript (Node) 
kernel available.


### macOS

In macOS, [Homebrew](http://brew.sh/) and
[pip](https://pip.pypa.io/en/latest/installing) can be used to install
IJavascript and its prerequisites:

```sh
ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
brew install pkg-config node zeromq
sudo easy_install pip
pip install --upgrade pyzmq jupyter
npm install -g ijavascript
ijsexinstall
```

# Contributions

First of all, thank you for taking the time to contribute. Please, read
[CONTRIBUTING](http://n-riesco.github.io/ijavascriptex/CONTRIBUTING.md) and use
the [issue tracker](https://github.com/n-riesco/ijavascript/issues) for any
contributions: support requests, bug reports, enhancement requests, pull
requests, submission of tutorials...

