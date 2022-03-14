<?php
$state = shell_exec('lessc style.less css/style.css');
if($state)
{
    $to_print = $state;
    if($state === true)
        $to_print = 'true';
    if($state === false)
        $to_print = 'false';
    echo basename(__FILE__) . ': ';
    print_r($to_print);
}
?>