<!DOCTYPE html>
<html>
    <head>
        <?php require("php/head.php") ?>
        
        <title>Gauss</title>
        <meta name="description" content="Gauss"> 
    </head>
    <body class="body default_style"> 
        <header class="header">
        </header>

        <main class="main">
            <div class="limit_box">
                <h1 class="main__title">Gauss</h1>
                
                <textarea class="main__input" data-id="input">
X := [[
  1 2 3,
  1 1 1,
  1 1 1,
]];

Y := [[
  1 2 3,
  1 1 1,
  1 1 1,
]];

Z := [[
  1 2 3
]];

RES := product(X, Y, Z);

[X, Y, Z, RES, product(1, 2, 3)]
                </textarea>

                <div class="main__controls">
                    <button class="main__calculate" data-id="calculate">
                        Go
                    </button>
                    <input class="main__show_parse" type="checkbox" id="show_parse" data-id="show_parse"></input>
                    <label for="show_parse">Show parser result</label>
                </div>

                <div>
                    <div class="main__output" data-id="output">
                    </div>
                </div>
            </div>
        </main>

        <footer class="footer">   
        </footer>
    
        <div style="display: none">
            <?php require("php/foot.php") ?>
        </div>
    </body>
</html>