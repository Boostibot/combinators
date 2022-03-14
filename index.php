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
A := {
    x := 1;
    x += 1;

    X := [[
        0  x  x+2,
        x  2  2x,
        x  3x 4,
    ]];

    X
};

I := [[
    1 0 0,
    0 1 0,
    0 0 1
]];

INV := ((1/2A + I)^(0-1));

E := [[
   1 1 1 1 1 1, 
   1 1 1 1 1 1, 
   1 1 1 1 1 1, 
]];

D := (I * E);

[A, I, D, INV]
                
                </textarea>

                <div class="main__controls">
                    <button class="main__calculate" data-id="calculate">
                        Go
                    </button>
                    <input class="main__show_parse" type="checkbox" id="show_parse" data-id="show_parse"></input>
                    <label for="show_parse">Show parser result</label>
                </div>

                <pre class="main__output" data-id="output">
                </pre>
            </div>
        </main>

        <footer class="footer">   
        </footer>
    
        <div style="display: none">
            <?php require("php/foot.php") ?>
        </div>
    </body>
</html>