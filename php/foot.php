<script type="text/javascript" src="js/lib/lib.js"         ></script>
<script type="text/javascript" src="js/lib/base.js"        ></script>
<script type="text/javascript" src="js/lib/vision.js"      ></script>
<script type="text/javascript" src="js/lib/query.js"       ></script>
<script type="text/javascript" src="js/lib/attributes.js"  ></script>

<script type="text/javascript" src="js/lib/fast_start.js"      ></script>

<script type="text/javascript" src="gauss.js" ></script>
<script type="text/javascript" src="parser.js" ></script>
<script type="text/javascript" src="main.js"  ></script>
<script type="text/javascript">
    let lib = createLibrary();
    import_fastStart(lib);
    if(importedOk(lib) == false)
        console.log("import error");

    import_main(lib);
</script>