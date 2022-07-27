function importMain(lib)
{ 
    requireLib(lib, '@fastStart');

    const query = lib.query;
    const selector = lib.selector;
    const parsers = importParsers(lib);
    const evaluators = importEvaluators(lib);

    function parse()
    {
        const input = query.single(selector.data_id('input'));
        const output = query.single(selector.data_id('output'));
        const checkbox = query.single(selector.data_id('show_parse'));

        try 
        {
            const parsed = parsers.parse(input.value);
            if(checkbox.checked)
            {
                output.textContent = evaluators.formatToken(parsed);
            }
            else
            {
                const evaluated = evaluators.evaluate(parsed);
                const sringified = evaluators.formatValue(evaluated);
                output.textContent = sringified;
            }
        }
        catch(error)
        {
            output.textContent = 'ERROR: ' + error.message;
        }
    }

    function add_events()
    {
        query.all(selector.data_id('calculate'), document, button => {
            button.addEventListener('click', parse);
        });
    }

    add_events();
    return lib;
}